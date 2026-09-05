//! Bounded subprocess I/O. A deadline covers stdin, execution and pipe draining.
use std::io::{self, Read, Write};
use std::process::{Child, Command, Output, Stdio};
#[cfg(windows)]
use std::sync::mpsc;
use std::time::{Duration, Instant};

pub const DEFAULT_OUTPUT_LIMIT: usize = 4 * 1024 * 1024;

#[cfg(windows)]
enum Completed {
    Input(io::Result<()>),
    Stdout(io::Result<Vec<u8>>),
    Stderr(io::Result<Vec<u8>>),
}

#[cfg(windows)]
fn read_bounded(mut reader: impl Read, limit: usize) -> io::Result<Vec<u8>> {
    let mut bytes = Vec::new();
    (&mut reader)
        .take(limit as u64 + 1)
        .read_to_end(&mut bytes)?;
    if bytes.len() > limit {
        Err(io::Error::other("subprocess output limit exceeded"))
    } else {
        Ok(bytes)
    }
}

/// The caller supplies arguments as data; this function never builds shell text.
/// Long-lived daemons must explicitly detach/redirect their standard streams.
/// Commands must not attempt to escape their process group/job.
#[cfg(windows)]
pub fn output(
    command: &mut Command,
    input: Option<&[u8]>,
    timeout: Duration,
    output_limit: usize,
) -> io::Result<Output> {
    let deadline = Instant::now() + timeout;
    command
        .stdin(if input.is_some() {
            Stdio::piped()
        } else {
            Stdio::null()
        })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.process_group(0);
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    let mut child = command.spawn()?;
    let group = ProcessGroup::new(&child);
    let group = match group {
        Ok(group) => group,
        Err(error) => {
            let _ = child.kill();
            // Job assignment failure must not bypass the caller's deadline.
            std::thread::spawn(move || {
                let _ = child.wait();
            });
            return Err(error);
        }
    };
    let (tx, rx) = mpsc::channel();
    let stdout = child.stdout.take().expect("piped stdout");
    let stderr = child.stderr.take().expect("piped stderr");
    let writer = input.map(|bytes| (child.stdin.take().expect("piped stdin"), bytes.to_vec()));
    let mut readers = Vec::new();
    let out_tx = tx.clone();
    readers.push(std::thread::spawn(move || {
        let _ = out_tx.send(Completed::Stdout(read_bounded(stdout, output_limit)));
    }));
    let err_tx = tx.clone();
    readers.push(std::thread::spawn(move || {
        let _ = err_tx.send(Completed::Stderr(read_bounded(stderr, output_limit)));
    }));
    let mut input_done = writer.is_none();
    if let Some((mut stdin, bytes)) = writer {
        readers.push(std::thread::spawn(move || {
            let result = stdin.write_all(&bytes);
            drop(stdin); // EOF must reach the child before waiting for its exit.
            let _ = tx.send(Completed::Input(result));
        }));
    }
    let mut stdout = None;
    let mut stderr = None;
    let mut status = None;
    let result = (|| loop {
        while let Ok(done) = rx.try_recv() {
            match done {
                Completed::Input(result) => {
                    result?;
                    input_done = true;
                }
                Completed::Stdout(result) => stdout = Some(result?),
                Completed::Stderr(result) => stderr = Some(result?),
            }
        }
        if status.is_none() {
            status = child.try_wait()?;
        }
        if input_done && stdout.is_some() && stderr.is_some() && status.is_some() {
            return Ok(Output {
                status: status.unwrap(),
                stdout: stdout.take().unwrap(),
                stderr: stderr.take().unwrap(),
            });
        }
        if Instant::now() >= deadline {
            return Err(io::Error::new(
                io::ErrorKind::TimedOut,
                "subprocess deadline exceeded",
            ));
        }
        std::thread::sleep(
            Duration::from_millis(5).min(deadline.saturating_duration_since(Instant::now())),
        );
    })();
    if result.is_err() {
        group.kill();
        let _ = child.kill();
        // Do not turn an I/O deadline into an unbounded wait on a child stuck in
        // kernel I/O. A reaper retains ownership until that child becomes reapable.
        let cleanup = Instant::now() + Duration::from_millis(250);
        while matches!(child.try_wait(), Ok(None)) && Instant::now() < cleanup {
            std::thread::sleep(Duration::from_millis(5));
        }
        if matches!(child.try_wait(), Ok(None)) {
            std::thread::spawn(move || {
                let _ = child.wait();
            });
        }
    }
    // On success all three completion messages arrived. On failure the group
    // was terminated; never join a pipe thread until it is known to be done.
    for reader in readers {
        if reader.is_finished() {
            let _ = reader.join();
        }
    }
    result
}

/// Unix uses nonblocking pipes and poll, without spawning helper threads per
/// ubus call on the modem. Every pipe and the child share the same deadline.
#[cfg(unix)]
pub fn output(
    command: &mut Command,
    input: Option<&[u8]>,
    timeout: Duration,
    limit: usize,
) -> io::Result<Output> {
    use std::os::fd::AsRawFd;
    use std::os::unix::process::CommandExt;
    let deadline = Instant::now() + timeout;
    command
        .process_group(0)
        .stdin(if input.is_some() {
            Stdio::piped()
        } else {
            Stdio::null()
        })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut child = command.spawn()?;
    let group = ProcessGroup::new(&child)?;
    let mut stdin = child.stdin.take();
    let mut stdout = child.stdout.take();
    let mut stderr = child.stderr.take();
    let mut out = Vec::new();
    let mut err = Vec::new();
    let mut offset = 0;
    let mut status = None;
    let input = input.unwrap_or_default();
    let result = (|| {
        for fd in [
            stdin.as_ref().map(AsRawFd::as_raw_fd),
            stdout.as_ref().map(AsRawFd::as_raw_fd),
            stderr.as_ref().map(AsRawFd::as_raw_fd),
        ]
        .into_iter()
        .flatten()
        {
            unsafe {
                let flags = libc::fcntl(fd, libc::F_GETFL);
                if flags < 0 || libc::fcntl(fd, libc::F_SETFL, flags | libc::O_NONBLOCK) < 0 {
                    return Err(io::Error::last_os_error());
                }
            }
        }
        loop {
            if Instant::now() >= deadline {
                return Err(io::Error::new(
                    io::ErrorKind::TimedOut,
                    "subprocess deadline exceeded",
                ));
            }
            if let Some(writer) = stdin.as_mut() {
                if offset < input.len() {
                    match writer.write(&input[offset..input.len().min(offset + 65536)]) {
                        Ok(n) => offset += n,
                        Err(e)
                            if matches!(
                                e.kind(),
                                io::ErrorKind::WouldBlock | io::ErrorKind::Interrupted
                            ) => {}
                        Err(e) => return Err(e),
                    }
                }
                if offset == input.len() {
                    stdin.take();
                }
            }
            drain(&mut stdout, &mut out, limit)?;
            drain(&mut stderr, &mut err, limit)?;
            if status.is_none() {
                status = child.try_wait()?;
            }
            if let Some(status) = status {
                if stdin.is_none() && stdout.is_none() && stderr.is_none() {
                    return Ok(Output {
                        status,
                        stdout: out,
                        stderr: err,
                    });
                }
            }
            let mut fds = [
                libc::pollfd {
                    fd: stdin.as_ref().map_or(-1, AsRawFd::as_raw_fd),
                    events: libc::POLLOUT,
                    revents: 0,
                },
                libc::pollfd {
                    fd: stdout.as_ref().map_or(-1, AsRawFd::as_raw_fd),
                    events: libc::POLLIN,
                    revents: 0,
                },
                libc::pollfd {
                    fd: stderr.as_ref().map_or(-1, AsRawFd::as_raw_fd),
                    events: libc::POLLIN,
                    revents: 0,
                },
            ];
            let wait = deadline
                .saturating_duration_since(Instant::now())
                .as_millis()
                .min(10) as i32;
            let result = unsafe { libc::poll(fds.as_mut_ptr(), fds.len() as _, wait) };
            if result < 0 && io::Error::last_os_error().kind() != io::ErrorKind::Interrupted {
                return Err(io::Error::last_os_error());
            }
        }
    })();
    if result.is_err() {
        group.kill();
        let _ = child.kill();
        let cleanup = Instant::now() + Duration::from_millis(250);
        while matches!(child.try_wait(), Ok(None)) && Instant::now() < cleanup {
            std::thread::sleep(Duration::from_millis(5));
        }
        if matches!(child.try_wait(), Ok(None)) {
            std::thread::spawn(move || {
                let _ = child.wait();
            });
        }
    }
    result
}

#[cfg(unix)]
fn drain<R: Read>(reader: &mut Option<R>, output: &mut Vec<u8>, limit: usize) -> io::Result<()> {
    if let Some(stream) = reader.as_mut() {
        let mut buffer = [0; 8192];
        // Limit work per turn so an endless stream cannot starve the deadline
        // or the other output pipe.
        for _ in 0..8 {
            match stream.read(&mut buffer) {
                Ok(0) => {
                    reader.take();
                    break;
                }
                Ok(n) => {
                    if output.len().saturating_add(n) > limit {
                        return Err(io::Error::other("subprocess output limit exceeded"));
                    }
                    output.extend_from_slice(&buffer[..n]);
                }
                Err(e) if e.kind() == io::ErrorKind::WouldBlock => break,
                Err(e) if e.kind() == io::ErrorKind::Interrupted => continue,
                Err(e) => return Err(e),
            }
        }
    }
    Ok(())
}

#[cfg(unix)]
struct ProcessGroup(i32);
#[cfg(unix)]
impl ProcessGroup {
    fn new(child: &Child) -> io::Result<Self> {
        Ok(Self(child.id() as i32))
    }
    fn kill(&self) {
        unsafe {
            libc::kill(-self.0, libc::SIGKILL);
        }
    }
}

#[cfg(windows)]
struct ProcessGroup(windows_sys::Win32::Foundation::HANDLE);
#[cfg(windows)]
impl ProcessGroup {
    fn new(child: &Child) -> io::Result<Self> {
        use std::os::windows::io::AsRawHandle;
        use windows_sys::Win32::System::JobObjects::*;
        unsafe {
            let handle = CreateJobObjectW(std::ptr::null(), std::ptr::null());
            if handle.is_null() {
                return Err(io::Error::last_os_error());
            }
            let job = Self(handle);
            // Explicit termination on failure. Successful commands may launch
            // an intentional ADB server, so closing the job must not kill it.
            if AssignProcessToJobObject(handle, child.as_raw_handle()) == 0 {
                return Err(io::Error::last_os_error());
            }
            Ok(job)
        }
    }
    fn kill(&self) {
        unsafe {
            windows_sys::Win32::System::JobObjects::TerminateJobObject(self.0, 1);
        }
    }
}
#[cfg(windows)]
impl Drop for ProcessGroup {
    fn drop(&mut self) {
        unsafe {
            windows_sys::Win32::Foundation::CloseHandle(self.0);
        }
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    fn run(script: &str, input: Option<&[u8]>, limit: usize) -> io::Result<Output> {
        output(
            Command::new("sh").args(["-c", script]),
            input,
            Duration::from_millis(150),
            limit,
        )
    }
    #[test]
    fn blocked_stdin_is_inside_deadline() {
        let start = Instant::now();
        let error = run("sleep 5", Some(&vec![0; 4 * 1024 * 1024]), 1024).unwrap_err();
        assert_eq!(error.kind(), io::ErrorKind::TimedOut);
        assert!(start.elapsed() < Duration::from_secs(2));
    }
    #[test]
    fn inherited_output_pipe_is_inside_deadline() {
        let start = Instant::now();
        assert_eq!(
            run("sleep 5 & exit 0", None, 1024).unwrap_err().kind(),
            io::ErrorKind::TimedOut
        );
        assert!(start.elapsed() < Duration::from_secs(2));
    }
    #[test]
    fn collects_both_pipes_and_delivers_eof() {
        let result = run("cat; printf error >&2", Some(b"hello"), 1024).unwrap();
        assert!(result.status.success());
        assert_eq!(result.stdout, b"hello");
        assert_eq!(result.stderr, b"error");
    }
    #[test]
    fn terminates_excess_output() {
        assert!(run("yes", None, 1024)
            .unwrap_err()
            .to_string()
            .contains("output limit"));
    }
}

#[cfg(all(test, windows))]
mod windows_tests {
    use super::*;
    fn command(script: &str) -> Command {
        let mut command = Command::new("powershell.exe");
        command.args(["-NoProfile", "-NonInteractive", "-Command", script]);
        command
    }
    #[test]
    fn blocked_stdin_obeys_windows_deadline() {
        let start = Instant::now();
        let result = output(
            &mut command("Start-Sleep -Seconds 10"),
            Some(&vec![0; 4 * 1024 * 1024]),
            Duration::from_millis(250),
            1024,
        );
        assert_eq!(result.unwrap_err().kind(), io::ErrorKind::TimedOut);
        assert!(start.elapsed() < Duration::from_secs(2));
    }
    #[test]
    fn windows_output_is_bounded() {
        let result = output(
            &mut command("[Console]::Write(('x' * 1000000))"),
            None,
            Duration::from_secs(15),
            1024,
        );
        assert!(result.unwrap_err().to_string().contains("output limit"));
    }
    #[test]
    fn windows_input_eof_and_both_outputs_are_collected() {
        let result = output(
            &mut command(
                "[Console]::Write([Console]::In.ReadToEnd()); [Console]::Error.Write('error')",
            ),
            Some(b"hello"),
            Duration::from_secs(15),
            1024,
        )
        .unwrap();
        assert!(result.status.success());
        assert_eq!(result.stdout, b"hello");
        assert_eq!(result.stderr, b"error");
    }
}
