interface PollOptions<T> {
  read: () => Promise<T>
  publish: (value: T) => void
  error: (message: string) => void
  refreshing: (value: boolean) => void
  interval: () => number
  visible: () => boolean
}

/** One owner for a poll's request and timer. Mutations invalidate older reads. */
export class PollScheduler<T> {
  private active = false
  private busy = false
  private revision = 0
  private pendingRefresh = false
  private timer: ReturnType<typeof setTimeout> | undefined

  private readonly options: PollOptions<T>

  constructor(options: PollOptions<T>) { this.options = options }

  start() {
    this.active = true
    this.wake()
  }

  stop() {
    this.active = false
    this.revision++
    this.pendingRefresh = false
    clearTimeout(this.timer)
  }

  wake() {
    clearTimeout(this.timer)
    if (this.active && this.options.visible() && !this.busy) void this.run()
  }

  refresh() {
    if (!this.active) return
    this.revision++
    this.pendingRefresh = true
    this.options.refreshing(true)
    this.wake()
  }

  mutate(value: T) {
    if (!this.active) return
    this.revision++
    this.options.publish(value)
  }

  private async run() {
    if (!this.active || this.busy || !this.options.visible()) return
    this.busy = true
    this.pendingRefresh = false
    const revision = this.revision
    try {
      const value = await this.options.read()
      if (this.active && revision === this.revision) this.options.publish(value)
    } catch (error) {
      if (this.active && revision === this.revision) {
        this.options.error(error instanceof Error ? error.message : String(error))
      }
    } finally {
      this.busy = false
      if (this.active) {
        if (!this.pendingRefresh) this.options.refreshing(false)
        if (this.options.visible()) {
          // Visibility changes never create a second owner while read() is pending.
          this.timer = setTimeout(() => void this.run(), this.pendingRefresh ? 0 : this.options.interval())
        }
      }
    }
  }
}
