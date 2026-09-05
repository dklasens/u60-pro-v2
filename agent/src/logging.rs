//! Bounded CSV sessions shared by the signal and connection loggers.
use crate::cache::Observed;
use crate::csv_utils::now_secs;
use crate::util::MutexExt;
use serde::Deserialize;
use serde_json::{json, Value};
use std::fs::{self, File, OpenOptions};
use std::io::{self, BufWriter, Write};
use std::os::unix::fs::OpenOptionsExt;
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

pub const MAX_BYTES: u64 = 8 * 1024 * 1024;
const FLUSH_INTERVAL: Duration = Duration::from_secs(30);
type Rows = fn(u64, &Value, &mut Option<Value>) -> Vec<String>;

#[derive(Default)]
struct State {
    running: bool,
    stop: bool,
    started: Option<Instant>,
    duration: u64,
    interval: u64,
    rows: u64,
    error: Option<String>,
}
pub struct Session {
    state: Mutex<State>,
}
impl Session {
    pub fn new() -> Self {
        Self {
            state: Mutex::default(),
        }
    }
    pub fn start(
        self: &Arc<Self>,
        body: &[u8],
        radio: Arc<Observed<Value>>,
        path: &'static str,
        header: &'static str,
        rows: Rows,
    ) -> (u16, Value) {
        #[derive(Deserialize)]
        #[serde(deny_unknown_fields)]
        struct Request {
            duration_secs: Option<u64>,
            interval_secs: Option<u64>,
        }
        let request: Request = match serde_json::from_slice(body) {
            Ok(value) => value,
            Err(error) => return (400, json!({"ok": false, "error": error.to_string()})),
        };
        let duration = request.duration_secs.unwrap_or(3600);
        let interval = request.interval_secs.unwrap_or(3);
        if !(1..=86400).contains(&duration) || !(1..=60).contains(&interval) {
            return (
                400,
                json!({"ok": false, "error": "duration must be 1–86400 seconds and interval 1–60 seconds"}),
            );
        }
        let mut state = self.state.safe_lock();
        if state.running {
            return (409, json!({"ok": false, "error": "logger already running"}));
        }
        *state = State {
            running: true,
            started: Some(Instant::now()),
            duration,
            interval,
            ..State::default()
        };
        let session = self.clone();
        std::thread::spawn(move || session.run(radio, path, header, rows, duration, interval));
        (
            200,
            json!({"ok": true, "data": {"duration_secs": duration, "interval_secs": interval}}),
        )
    }
    pub fn stop(&self) -> (u16, Value) {
        self.state.safe_lock().stop = true;
        (200, json!({"ok": true}))
    }
    pub fn status(&self, count_key: &str) -> (u16, Value) {
        let state = self.state.safe_lock();
        (
            200,
            json!({"ok": true, "data": {"running": state.running, count_key: state.rows,
                "elapsed_secs": state.started.map(|t| t.elapsed().as_secs().min(state.duration)).unwrap_or(0),
                "duration_secs": state.duration, "interval_secs": state.interval, "last_error": state.error,
                "max_bytes": MAX_BYTES, "flush_interval_secs": FLUSH_INTERVAL.as_secs(),
            }}),
        )
    }
    fn run(
        &self,
        radio: Arc<Observed<Value>>,
        path: &str,
        header: &str,
        rows: Rows,
        duration: u64,
        interval: u64,
    ) {
        let result = (|| -> Result<(), String> {
            let temporary = format!("{path}.new");
            let file = OpenOptions::new()
                .write(true)
                .create(true)
                .truncate(true)
                .mode(0o600)
                .open(&temporary)
                .map_err(|e| e.to_string())?;
            let mut writer = CsvWriter::new(BufWriter::with_capacity(64 * 1024, file), MAX_BYTES);
            writer
                .row(header)
                .and_then(|_| writer.flush())
                .map_err(|e| e.to_string())?;
            fs::rename(&temporary, path).map_err(|e| e.to_string())?;
            let start = Instant::now();
            let mut previous = None;
            let mut last_sample = None;
            let sampling = (|| -> Result<(), String> {
                while start.elapsed() < Duration::from_secs(duration)
                    && !self.state.safe_lock().stop
                {
                    let sample = crate::handlers::read_radio(&radio);
                    if let Some(error) = sample.freshness.error {
                        self.state.safe_lock().error =
                            Some(format!("radio sample unavailable: {error}"));
                    } else if sample.freshness.sampled_at_ms != last_sample {
                        if let Some(data) = sample.value {
                            let ts = sample
                                .freshness
                                .sampled_at_ms
                                .map(|ms| (ms / 1000) as u64)
                                .unwrap_or_else(now_secs);
                            for row in rows(ts, &data, &mut previous) {
                                writer.row(&row).map_err(|e| e.to_string())?;
                                self.state.safe_lock().rows += 1;
                            }
                            last_sample = sample.freshness.sampled_at_ms;
                            self.state.safe_lock().error = None;
                        }
                    }
                    if writer.flushed.elapsed() >= FLUSH_INTERVAL {
                        writer.flush().map_err(|e| e.to_string())?;
                    }
                    let sleep_start = Instant::now();
                    while sleep_start.elapsed() < Duration::from_secs(interval)
                        && start.elapsed() < Duration::from_secs(duration)
                    {
                        if self.state.safe_lock().stop {
                            break;
                        }
                        std::thread::sleep(Duration::from_millis(100));
                    }
                }
                Ok(())
            })();
            let flushed = writer.flush().map_err(|e| e.to_string());
            sampling.and(flushed)
        })();
        let mut state = self.state.safe_lock();
        if let Err(error) = result {
            state.error = Some(error);
        }
        state.running = false;
    }
}

struct CsvWriter<W: Write> {
    writer: W,
    bytes: u64,
    limit: u64,
    flushed: Instant,
}
impl<W: Write> CsvWriter<W> {
    fn new(writer: W, limit: u64) -> Self {
        Self {
            writer,
            bytes: 0,
            limit,
            flushed: Instant::now(),
        }
    }
    fn row(&mut self, row: &str) -> io::Result<()> {
        if row.len() > 64 * 1024 || self.bytes.saturating_add(row.len() as u64 + 1) > self.limit {
            return Err(io::Error::other("CSV size limit reached; logging stopped"));
        }
        self.writer.write_all(row.as_bytes())?;
        self.writer.write_all(b"\n")?;
        self.bytes += row.len() as u64 + 1;
        Ok(())
    }
    fn flush(&mut self) -> io::Result<()> {
        self.writer.flush()?;
        self.flushed = Instant::now();
        Ok(())
    }
}

/// Snapshot the length before streaming, so an active session cannot extend
/// the response indefinitely. The open descriptor survives the next log start.
pub fn open_download(path: &str) -> io::Result<(File, u64)> {
    let file = File::open(Path::new(path))?;
    let len = file.metadata()?.len().min(MAX_BYTES);
    Ok((file, len))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn size_limit_rejects_whole_row_and_bounds_output() {
        let mut writer = CsvWriter::new(Vec::new(), 8);
        writer.row("abc").unwrap();
        writer.row("def").unwrap();
        assert!(writer.row("x").is_err());
        assert_eq!(writer.writer, b"abc\ndef\n");
    }
    struct FailingWriter;
    impl Write for FailingWriter {
        fn write(&mut self, _: &[u8]) -> io::Result<usize> {
            Err(io::Error::other("storage full"))
        }
        fn flush(&mut self) -> io::Result<()> {
            Err(io::Error::other("flush failed"))
        }
    }
    #[test]
    fn write_and_flush_failures_are_not_successful_samples() {
        let mut writer = CsvWriter::new(FailingWriter, 100);
        assert!(writer.row("sample").is_err());
        assert_eq!(writer.bytes, 0);
        assert!(writer.flush().is_err());
    }
}
