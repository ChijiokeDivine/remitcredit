"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

type FAQItem = {
  question: string;
  answer: string;
};

const FAQS: FAQItem[] = [
  {
    question: "What exactly does Lassie handle for me?",
    answer:
      "Lassie takes care of the repetitive admin that eats your day — insurance calls, claim follow-ups, appointment recalls, billing questions, and routine patient outreach — so you can stay focused on actual care.",
  },
  {
    question: "Does it work with my existing practice software?",
    answer:
      "Yes. Lassie connects with the major practice management systems and can also work alongside whatever tools you already use. Setup is lightweight and doesn’t require ripping out your current stack.",
  },
  {
    question: "How does the voice calling actually work?",
    answer:
      "Lassie places real outbound calls, follows natural conversation flows, and handles common objections or hold times. You get a clean summary after every call so nothing falls through the cracks.",
  },
  {
    question: "Is patient data secure?",
    answer:
      "Absolutely. We are built with HIPAA compliance in mind, use encrypted channels, and never train models on your practice data. Your information stays yours.",
  },
  {
    question: "How long does it take to get started?",
    answer:
      "Most practices are live within a few days. We handle the initial configuration, train the system on your preferred scripts and tone, and then you simply start assigning tasks.",
  },
  {
    question: "What if Lassie can’t resolve something?",
    answer:
      "It escalates cleanly. You’ll receive a clear handoff with context so your team can finish the conversation without starting from zero.",
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