import Link from "next/link";

export const metadata = {
  title: "Legal — GymSnap",
  description:
    "Terms of Use, Privacy Policy, Medical & Fitness Disclaimer, Limitation of Liability, Assumption of Risk, and Cookie Policy for GymSnap.",
};

const LAST_UPDATED = "July 7, 2026";

const SECTIONS = [
  { id: "terms", label: "Terms of Use" },
  { id: "medical", label: "Medical & Fitness Disclaimer" },
  { id: "risk", label: "Assumption of Risk" },
  { id: "liability", label: "Limitation of Liability" },
  { id: "privacy", label: "Privacy Policy" },
  { id: "cookies", label: "Cookie Policy" },
];

export default function LegalPage() {
  return (
    <main className="flex flex-col gap-6 p-4 pb-8">
      <header>
        <h1 className="text-xl font-bold">Legal</h1>
        <p className="mt-1 text-xs text-ink-tertiary">Last updated: {LAST_UPDATED}</p>
        <nav className="mt-3 flex flex-wrap gap-1.5">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="rounded-full bg-accent-fill px-2.5 py-1 text-xs text-ink-secondary"
            >
              {s.label}
            </a>
          ))}
        </nav>
      </header>

      <div className="flex flex-col gap-6 text-sm leading-relaxed text-ink-secondary [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-ink [&_h3]:mt-1 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-ink [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
        {/* ---------------- TERMS OF USE ---------------- */}
        <section id="terms" className="flex flex-col gap-2 scroll-mt-4">
          <h2>Terms of Use</h2>
          <p>
            GymSnap (&ldquo;the Service&rdquo;) is a free beta web application
            that suggests possible exercises based on the exercise equipment you
            select or photograph. By accessing or using the Service you agree to
            these Terms of Use and to every policy on this page. If you do not
            agree, do not use the Service.
          </p>
          <h3>Informational purpose only</h3>
          <ul>
            <li>
              The Service is provided for educational and informational purposes
              only.
            </li>
            <li>
              The Service is <strong>not</strong> an online trainer, coach, or
              personal training service.
            </li>
            <li>
              The Service is not a substitute for in-person, individual
              consultation with a qualified fitness or health professional.
            </li>
            <li>
              The Service does <strong>not</strong> analyze your medical
              indicators, physical condition, fitness level, limitations,
              injuries, or any other individual factors. Exercise suggestions are
              generated solely from the equipment you select or photograph.
            </li>
            <li>
              Exercise suggestions are produced by an automated system and are
              informational only. Results may be incomplete or contain errors and
              must not be treated as professional advice or a professional
              recommendation.
            </li>
          </ul>
          <h3>Eligibility</h3>
          <p>You must be at least 18 years old to use the Service.</p>
          <h3>Beta status</h3>
          <p>
            The Service is beta software provided free of charge, &ldquo;as
            is&rdquo; and &ldquo;as available&rdquo;, without warranties of any
            kind, express or implied, including fitness for a particular purpose,
            accuracy, or availability. Features may change or be removed, and
            data may be lost, at any time and without notice.
          </p>
          <h3>Acceptable use</h3>
          <p>
            You agree not to misuse the Service, including attempting to access
            other users&rsquo; data, disrupting the Service, or using it for any
            unlawful purpose. You are responsible for the photos you upload and
            must have the right to upload them.
          </p>
          <h3>Governing law</h3>
          <p>
            These terms are governed by the laws of the Province of Alberta,
            Canada, without regard to conflict-of-law rules.
          </p>
        </section>

        {/* ---------------- MEDICAL DISCLAIMER ---------------- */}
        <section id="medical" className="flex flex-col gap-2 scroll-mt-4">
          <h2>Medical &amp; Fitness Disclaimer</h2>
          <ul>
            <li>The Service does not provide medical advice.</li>
            <li>The Service does not perform diagnosis of any kind.</li>
            <li>The Service does not prescribe or recommend treatment.</li>
            <li>No results of any kind are promised or guaranteed.</li>
          </ul>
          <p>
            All content, including exercise suggestions, descriptions, and
            images, is general information. It is not tailored to you, and it is
            not medical, health, or professional fitness advice. Always consult a
            physician or qualified health professional before beginning any
            exercise activity — especially if you have or suspect any medical
            condition or injury, are pregnant, or have not exercised recently.
            Never disregard professional medical advice, or delay seeking it,
            because of something you saw on the Service.
          </p>
        </section>

        {/* ---------------- ASSUMPTION OF RISK ---------------- */}
        <section id="risk" className="flex flex-col gap-2 scroll-mt-4">
          <h2>Assumption of Risk</h2>
          <p>
            Physical exercise is inherently risky and can result in serious
            injury or death. By using the Service you confirm and agree that:
          </p>
          <ul>
            <li>
              you assess your own abilities, health, and limitations yourself,
              and choose which exercises (if any) to attempt entirely at your own
              discretion;
            </li>
            <li>
              you will stop exercising immediately if you experience pain,
              dizziness, shortness of breath, or any decline in how you feel, and
              will seek medical attention where appropriate;
            </li>
            <li>
              you bear sole responsibility for how you perform any exercise,
              including technique, load selection, and the safe and correct use
              of any equipment;
            </li>
            <li>
              you knowingly and voluntarily assume all risks arising from your
              use of the Service and from any physical activity you undertake in
              connection with it.
            </li>
          </ul>
        </section>

        {/* ---------------- LIMITATION OF LIABILITY ---------------- */}
        <section id="liability" className="flex flex-col gap-2 scroll-mt-4">
          <h2>Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by applicable law, GymSnap and its
            creator, and anyone involved in creating or operating the Service,
            shall not be liable for any direct, indirect, incidental,
            consequential, special, exemplary, or punitive damages — including
            personal injury, death, property damage, loss of data, or loss of
            profits — arising out of or in any way connected with your access to
            or use of (or inability to use) the Service, whether based in
            contract, tort (including negligence), strict liability, or any other
            legal theory, even if advised of the possibility of such damages.
            Where a jurisdiction does not allow certain exclusions or
            limitations, liability is limited to the greatest extent permitted by
            that jurisdiction&rsquo;s law. Because the Service is free, you agree
            that the total aggregate liability for any claim shall not exceed CAD
            $50.
          </p>
        </section>

        {/* ---------------- PRIVACY POLICY ---------------- */}
        <section id="privacy" className="flex flex-col gap-2 scroll-mt-4">
          <h2>Privacy Policy</h2>
          <h3>What we collect</h3>
          <ul>
            <li>
              <strong>Photos you upload</strong> (of gyms or equipment) — used to
              recognize equipment and stored so your equipment list can show
              them.
            </li>
            <li>
              <strong>Information you enter</strong> — such as age group, body
              weight, training preferences, and any limitations you describe.
              Enter only what you are comfortable sharing; free-text fields
              should not contain detailed medical information.
            </li>
            <li>
              <strong>Generated content</strong> — exercise suggestions and your
              check-ins.
            </li>
            <li>
              <strong>An anonymous identifier</strong> — a random ID stored in a
              cookie on your device (no name, email, or account is collected).
            </li>
          </ul>
          <h3>How it is processed</h3>
          <p>
            Data is stored with our hosting providers (Vercel — application and
            photo storage; Neon — database), and photos and the information you
            enter are processed by Anthropic&rsquo;s AI API to generate equipment
            lists and exercise suggestions. These providers process data on
            servers located in the United States. We do not sell your data or use
            it for advertising.
          </p>
          <h3>Your choices</h3>
          <p>
            The Service works without any account. Clearing your browser cookies
            disconnects your device from its data. To request deletion of data
            associated with your device, contact us (see below) and include the
            approximate dates you used the Service.
          </p>
          <h3>Contact</h3>
          <p>
            Questions about this policy or data deletion requests:{" "}
            <a className="text-accent underline" href="mailto:koniakhinden@gmail.com">
              koniakhinden@gmail.com
            </a>
          </p>
        </section>

        {/* ---------------- COOKIE POLICY ---------------- */}
        <section id="cookies" className="flex flex-col gap-2 scroll-mt-4">
          <h2>Cookie Policy</h2>
          <p>The Service uses only strictly necessary, first-party storage:</p>
          <ul>
            <li>
              <code>gymsnap_uid</code> — a cookie containing a random anonymous
              identifier that links your device to your own data (equipment,
              suggestions, check-ins). Lifetime: about 400 days.
            </li>
            <li>
              <code>gymsnap_disclaimer_accepted</code> — a browser storage entry
              recording that you accepted the entry disclaimer, with a timestamp.
            </li>
          </ul>
          <p>
            No analytics, advertising, or third-party tracking cookies are used.
            Because these items are strictly necessary for the Service to
            function, no cookie consent banner is required; you can remove them
            at any time by clearing your browser data, which resets your device
            to a blank state.
          </p>
        </section>
      </div>

      <Link href="/" className="text-sm font-medium text-accent">
        ← Back to GymSnap
      </Link>
    </main>
  );
}
