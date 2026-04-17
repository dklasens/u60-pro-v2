import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border pt-12 pb-6">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-3">
          <div>
            <div className="mb-2 font-mono text-[0.9375rem] font-bold">
              open-u60-pro
            </div>
            <p className="text-[0.8125rem] leading-relaxed text-text-dim">
              Open-source toolkit for the ZTE U60 Pro 5G mobile router.
              On-device agent, native companion apps, and web bootstrap
              tools.
            </p>
          </div>
          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-dim">
              Links
            </h4>
            <ul className="space-y-2">
              <li>
                <a
                  href="https://github.com/jesther-ai/open-u60-pro"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[0.8125rem] text-text-dim transition-colors hover:text-text"
                >
                  GitHub Repo
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/jesther-ai/open-u60-pro/releases"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[0.8125rem] text-text-dim transition-colors hover:text-text"
                >
                  Releases
                </a>
              </li>
              <li>
                <Link
                  href="/docs"
                  className="text-[0.8125rem] text-text-dim transition-colors hover:text-text"
                >
                  Documentation
                </Link>
              </li>
              <li>
                <Link
                  href="/download"
                  className="text-[0.8125rem] text-text-dim transition-colors hover:text-text"
                >
                  Download
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-dim">
              Project
            </h4>
            <ul className="space-y-2">
              <li>
                <a
                  href="https://github.com/jesther-ai/open-u60-pro/blob/main/LICENSE"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[0.8125rem] text-text-dim transition-colors hover:text-text"
                >
                  MIT License
                </a>
              </li>
              <li>
                <Link
                  href="/setup"
                  className="text-[0.8125rem] text-text-dim transition-colors hover:text-text"
                >
                  Setup Wizard
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="text-[0.8125rem] text-text-dim transition-colors hover:text-text"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/legal"
                  className="text-[0.8125rem] text-text-dim transition-colors hover:text-text"
                >
                  Legal
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-5 text-xs text-text-dim">
          <span>Built by jesther-ai</span>
          <span>Not affiliated with ZTE Corporation</span>
        </div>
      </div>
    </footer>
  );
}
