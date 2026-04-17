import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Legal — OpenU60",
  description:
    "Legal disclaimers, warranty information, and trademark notices for the OpenU60 project.",
};

export default function LegalPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="mb-2 font-display text-2xl font-bold">
        Legal Disclaimers
      </h1>
      <p className="mb-8 text-sm text-text-dim">Last updated: March 10, 2026</p>

      <div className="space-y-6 text-sm leading-relaxed text-text-dim">
        <section>
          <h2 className="mb-2 text-base font-semibold text-text">Disclaimer</h2>
          <p>
            OpenU60 is an independent open-source project. It is not affiliated
            with, endorsed by, or sponsored by ZTE Corporation. ZTE, U60 Pro,
            and MU5250 are trademarks of ZTE Corporation.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-text">License</h2>
          <p className="mb-2">
            OpenU60 is released under the{" "}
            <a
              href="https://github.com/jesther-ai/open-u60-pro/blob/main/LICENSE"
              className="text-accent hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              MIT License
            </a>
            .
          </p>
          <p className="rounded border border-border bg-surface-1 px-3 py-2 font-mono text-xs leading-relaxed">
            THE SOFTWARE IS PROVIDED &quot;AS IS&quot;, WITHOUT WARRANTY OF ANY
            KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
            OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
            NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS
            BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
            ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
            CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
            SOFTWARE.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-text">
            No Warranty
          </h2>
          <p>
            This software is provided &quot;as is&quot; without warranty of any
            kind, either express or implied. There is no guarantee that the
            software will be error-free, uninterrupted, or fit for any
            particular purpose. You use it entirely at your own risk.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-text">
            Limitation of Liability
          </h2>
          <p>
            The authors and contributors of this project are not responsible for
            any damage to devices, voided manufacturer warranties, bricked
            routers, data loss, network disruptions, or any other consequences
            arising from the use of this software. You assume all responsibility
            for any changes made to your device.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-text">
            Intended Use
          </h2>
          <p>
            This software is intended for use on devices you personally own and
            have full administrative access to. It is not intended for
            unauthorized access to devices you do not own or control. You are
            solely responsible for ensuring your use complies with applicable
            laws and regulations.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-text">
            Device Modification Warning
          </h2>
          <p>
            The on-device agent and companion apps expose control endpoints that
            can modify firmware settings, network configuration, and perform
            potentially destructive actions including factory reset and reboot.
            These actions may void your manufacturer warranty. By using this
            software, you accept full responsibility for any changes made to
            your device.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-text">
            Reverse Engineering
          </h2>
          <p>
            All reverse engineering in this project has been performed solely for
            interoperability and educational purposes under applicable fair use
            and interoperability exceptions (including but not limited to EU
            Directive 2009/24/EC and U.S. fair use doctrine). No proprietary
            source code from ZTE Corporation is included in this project.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-text">
            No Proprietary Code
          </h2>
          <p>
            No ZTE proprietary source code, binaries, or copyrighted assets are
            distributed as part of this project. Encryption keys and protocol
            details were sourced from publicly available community research and
            standard interoperability analysis.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-text">
            Trademarks
          </h2>
          <p>
            ZTE, U60 Pro, and MU5250 are trademarks of ZTE Corporation.
            Qualcomm and Snapdragon are trademarks of Qualcomm Incorporated. All
            other trademarks are the property of their respective owners. These
            names are used in this project for identification purposes only and
            do not imply endorsement.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-text">Contact</h2>
          <p>
            For legal inquiries, please open an issue on the{" "}
            <a
              href="https://github.com/jesther-ai/open-u60-pro/issues"
              className="text-accent hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub repository
            </a>
            .
          </p>
        </section>

        <section className="border-t border-border pt-6">
          <p className="text-xs">
            OpenU60 is not affiliated with, endorsed by, or sponsored by ZTE
            Corporation. ZTE and U60 Pro are trademarks of ZTE Corporation.
          </p>
        </section>
      </div>
    </div>
  );
}
