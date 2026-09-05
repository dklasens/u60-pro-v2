use std::ffi::{OsStr, OsString};
use std::path::{Path, PathBuf};
use std::process::{Command, Output};
use std::time::Duration;

use crate::model::InstallerError;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

pub fn command(program: impl AsRef<OsStr>) -> Command {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let mut command = Command::new(program);
        command.creation_flags(CREATE_NO_WINDOW);
        command
    }
    #[cfg(not(windows))]
    {
        Command::new(program)
    }
}

pub fn run(
    program: &Path,
    args: &[OsString],
    input: Option<&[u8]>,
    context: &str,
) -> Result<Output, InstallerError> {
    run_timeout(program, args, input, context, Duration::from_secs(600))
}

pub fn run_timeout(
    program: &Path,
    args: &[OsString],
    input: Option<&[u8]>,
    context: &str,
    timeout: Duration,
) -> Result<Output, InstallerError> {
    process_runner::output(
        command(program.as_os_str()).args(args), input, timeout,
        process_runner::DEFAULT_OUTPUT_LIMIT,
    ).map_err(|error| InstallerError::new(
        format!("Couldn’t finish {context}"),
        "Check the modem connection. The operation stopped at its deadline or failed; detect again before retrying.",
        format!("{}: {error}", program.display()),
    ))
}

pub fn find_on_path(name: &str) -> Option<PathBuf> {
    let path = std::env::var_os("PATH")?;
    let names: Vec<OsString> = if cfg!(windows) && !name.to_ascii_lowercase().ends_with(".exe") {
        vec![format!("{name}.exe").into(), name.into()]
    } else {
        vec![name.into()]
    };
    std::env::split_paths(&path)
        .flat_map(|directory| names.iter().map(move |name| directory.join(name)))
        .find(|candidate| candidate.is_file())
}

pub fn output_text(output: &Output) -> (String, String) {
    (
        String::from_utf8_lossy(&output.stdout).trim().to_owned(),
        String::from_utf8_lossy(&output.stderr).trim().to_owned(),
    )
}
