"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "gymsnap_disclaimer_accepted_v1";

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
    <div className="fixed inset-0 z-[100] bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5 flex flex-col gap-4">
        <div>
          <span className="inline-block text-[10px] font-bold tracking-widest uppercase bg-amber-100 text-amber-800 rounded-full px-2 py-0.5 mb-2">
            Beta
          </span>
          <h1 className="text-lg font-bold">Before you use GymSnap</h1>
        </div>

        <div className="text-xs text-gray-600 flex flex-col gap-2.5 leading-relaxed">
          <p>
            <strong>Not medical advice.</strong> GymSnap provides AI-generated,
            general fitness information for educational purposes only. It is not
            medical advice, diagnosis, or treatment, and it is not a substitute
            for guidance from a physician or qualified health professional.
            Consult your doctor before starting this or any exercise program —
            especially if you have (or suspect) any medical condition, injury,
            or are pregnant.
          </p>
          <p>
            <strong>Assumption of risk.</strong> Physical exercise carries
            inherent risks, including serious injury. You are solely responsible
            for exercising within your limits and for the correct, safe use of
            any equipment. Stop immediately and seek medical attention if you
            feel pain, dizziness, shortness of breath, or discomfort.
          </p>
          <p>
            <strong>AI-generated content.</strong> Workout plans are generated
            automatically and may contain errors, including exercises or loads
            that are not appropriate for you. Review every suggestion critically
            before attempting it.
          </p>
          <p>
            <strong>Beta software.</strong> GymSnap is a free beta provided
            &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without
            warranties of any kind, express or implied. Features may change or
            break, and your data may be lost at any time.
          </p>
          <p>
            <strong>Limitation of liability.</strong> To the maximum extent
            permitted by applicable law, GymSnap and its creator disclaim all
            liability for any injury, loss, or damage of any kind arising from
            or related to your use of this service.
          </p>
          <p>
            <strong>Age.</strong> You must be 18 years or older to use GymSnap.
          </p>
        </div>

        <label className="flex items-start gap-2 text-xs text-gray-700">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          <span>
            I am 18 or older, I have read and understood the above, and I
            voluntarily accept all risks of using GymSnap.
          </span>
        </label>

        <button
          type="button"
          disabled={!checked}
          onClick={accept}
          className="rounded-lg bg-gray-900 text-white py-3 font-semibold disabled:opacity-40"
        >
          I agree — continue
        </button>
      </div>
    </div>
  );
}
