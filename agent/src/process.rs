use std::process::{Command, Output};
use std::time::Duration;

pub trait BoundedCommand {
    fn bounded_output(&mut self) -> std::io::Result<Output>;
}
impl BoundedCommand for Command {
    fn bounded_output(&mut self) -> std::io::Result<Output> {
        process_runner::output(self, None, Duration::from_secs(10), 2 * 1024 * 1024)
    }
}
