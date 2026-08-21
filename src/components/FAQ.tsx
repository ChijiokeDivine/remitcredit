"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

type FAQItem = {
  question: string;
  answer: string;
};

const FAQS: FAQItem[] = [
  {
    question: "What is RemitCredit?",
    answer:
      "RemitCredit turns verified crypto remittances into a credit line. No bank statements. No self-reported income. No human underwriter.",
  },
  {
    question: "How does verification work?",
    answer:
      "We use Creditcoin’s Attestcoin Protocol to cryptographically prove each transfer happened. The proof is checked on-chain in the same transaction. No bridge. No third-party oracle.",
  },
  {
    question: "Do I need a bank account or credit history?",
    answer:
      "No. Your credit line is built only from proven on-chain remittances. Traditional credit files and bank statements are not required.",
  },
  {
    question: "Who can use it?",
    answer:
      "Anyone who regularly receives stablecoin or crypto transfers from family or partners abroad and has a wallet they control.",
  },
  {
    question: "Does the sender need to do anything special?",
    answer:
      "No. They send the same way they always have. You simply declare their wallet addresses once. After that, everything is automatic.",
  },
  {
    question: "How is the credit limit decided?",
    answer:
      "A transparent rules engine looks at transfer count, total inflow, regularity, and recency. The limit updates the moment new verified data arrives. You can see exactly why.",
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="relative w-full bg-[#F3F5F4] px-6 py-24 md:py-32">
      <div className="mx-auto w-full max-w-[1100px]">
        {/* Section heading */}
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mt-4 font-[family-name:var(--font-serif)] text-[36px] font-normal leading-[1.1] tracking-[-0.01em] text-[#10202E] sm:text-[44px] md:text-[4rem]">
            Frequently Asked Questions
          </h2>
        </div>

        {/* FAQ list */}
        <div className="mt-16 space-y-4 md:mt-20 md:space-y-5">
          {FAQS.map((item, index) => {
            const isOpen = openIndex === index;

            return (
              <div
                key={index}
                className="overflow-hidden rounded-[28px] bg-white shadow-[0_2px_20px_-4px_rgba(16,32,46,0.06)] "
              >
                <button
                  type="button"
                  onClick={() => toggle(index)}
                  className="flex w-full items-center justify-between gap-6 px-8 py-7 text-left md:px-10 md:py-8"
                  aria-expanded={isOpen}
                >
                  <span className="text-[17px] font-medium leading-snug text-[#10202E] md:text-[19px]">
                    {item.question}
                  </span>

                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F3F5F4] transition-transform duration-300 ${
                      isOpen ? "rotate-180" : "rotate-0"
                    }`}
                  >
                    <ChevronDown
                      className="h-5 w-5 text-[#10202E]"
                      strokeWidth={2}
                    />
                  </span>
                </button>

                {/* Animated answer */}
                <div
                  className={`grid transition-all duration-300 ease-out ${
                    isOpen
                      ? "grid-rows-[1fr] opacity-100"
                      : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="px-8 pb-8 text-[15px] leading-[1.6] text-[#10202E]/70 md:px-10 md:pb-9 md:text-base">
                      {item.answer}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}