"use client";

import { useEffect, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Modal, Button } from "@/components/ui";

const STORAGE_KEY = "gymsnap_disclaimer_accepted_v2";

/**
 * Blocking first-visit disclaimer. The app is unusable until the visitor
 * explicitly accepts. Acceptance (with timestamp) is stored on the device;
 * bumping the _v1 suffix re-prompts everyone after a material change.
 */
export default function DisclaimerGate() {
  // null = not checked yet (avoids a flash), true/false = checked
  const [accepted, setAccepted] = useState<boolean | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    try {
      setAccepted(Boolean(localStorage.getItem(STORAGE_KEY)));
    } catch {
      setAccepted(false);
    }
  }, []);

  function accept() {
    try {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      // Private browsing without storage — let them through for this session.
    }
    setAccepted(true);
  }

  if (accepted === null || accepted) return null;

  return (
    <Modal
      open
      onClose={() => {}}
      dismissible={false}
      icon={TriangleAlert}
      tone="warning"
      title="Before you use GymSnap"
      footer={
        <Button block size="lg" disabled={!checked} onClick={accept}>
          I agree — continue
        </Button>
      }
    >
      <div className="flex flex-col gap-2.5 text-xs leading-relaxed text-ink-secondary">
        <p>
          <strong className="text-ink">Informational purpose only.</strong>{" "}
          GymSnap is an equipment-based exercise library for educational and
          informational purposes. It is not an online trainer or coaching
          service and does not replace individual consultation with a qualified
          professional. It does not analyze your medical indicators, physical
          condition, fitness level, limitations, or injuries — exercise
          suggestions are generated solely from the equipment you select, and
          no results are promised or guaranteed.
        </p>
        <p>
          <strong className="text-ink">Not medical advice.</strong> GymSnap
          provides AI-generated, general fitness information only. It is not
          medical advice, diagnosis, or treatment, and it is not a substitute
          for guidance from a physician or qualified health professional.
          Consult your doctor before starting this or any exercise activity —
          especially if you have (or suspect) any medical condition, injury, or
          are pregnant.
        </p>
        <p>
          <strong className="text-ink">Assumption of risk.</strong> Physical
          exercise carries inherent risks, including serious injury. You are
          solely responsible for exercising within your limits and for the
          correct, safe use of any equipment. Stop immediately and seek medical
          attention if you feel pain, dizziness, shortness of breath, or
          discomfort.
        </p>
        <p>
          <strong className="text-ink">AI-generated content.</strong> Workout
          plans are generated automatically and may contain errors, including
          exercises or loads that are not appropriate for you. Review every
          suggestion critically before attempting it.
        </p>
        <p>
          <strong className="text-ink">Beta software.</strong> GymSnap is a free
          beta provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;,
          without warranties of any kind, express or implied. Features may change
          or break, and your data may be lost at any time.
        </p>
        <p>
          <strong className="text-ink">Limitation of liability.</strong> To the
          maximum extent permitted by applicable law, GymSnap and its creator
          disclaim all liability for any injury, loss, or damage of any kind
          arising from or related to your use of this service.
        </p>
        <p>
          <strong className="text-ink">Age.</strong> You must be 18 years or
          older to use GymSnap.
        </p>
      </div>

      <p className="mt-3 text-xs text-ink-secondary">
        Full terms:{" "}
        <a href="/legal" className="text-accent underline" target="_blank">
          Terms of Use, Privacy &amp; Cookie Policy, Disclaimers
        </a>
      </p>

      <label className="mt-4 flex items-start gap-2 text-xs text-ink-secondary">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-accent"
        />
        <span>
          I am 18 or older, I have read and understood the above and the full
          terms, and I voluntarily accept all risks of using GymSnap.
        </span>
      </label>
    </Modal>
  );
}
