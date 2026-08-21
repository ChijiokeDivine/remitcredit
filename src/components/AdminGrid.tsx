import {
  PhoneOutgoing,
  CalendarClock,
  Receipt,
  FileText,
  BadgeCheck,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";

type AdminCard = {
  icon: LucideIcon;
  title: string;
  description: string;
  example: string;
};

// Six categories of practice admin Lassie handles. Each "example" line
// echoes the rotating proof-tag in the hero — same voice, different scene.
const CARDS: AdminCard[] = [
  {
    icon: PhoneOutgoing,
    title: "Insurance & claims",
    description:
      "Calls payers, files claims, and chases denials until they're paid.",
    example: "Called Cigna for claim status",
  },
  {
    icon: CalendarClock,
    title: "Scheduling & recalls",
    description:
      "Fills gaps in the calendar and books recall and hygiene visits.",
    example: "Booked 8 hygiene recalls",
  },
  {
    icon: Receipt,
    title: "Billing & bookkeeping",
    description: "Reconciles charges, posts payments, and closes the books.",
    example: "Closed the books for March",
  },
  {
    icon: FileText,
    title: "Referrals & records",
    description: "Sends referrals out and chases records requests down.",
    example: "Faxed records to Dr. Patel",
  },
  {
    icon: BadgeCheck,
    title: "Credentialing",
    description: "Keeps licenses, CE credits, and payer files current.",
    example: "Renewed the malpractice policy",
  },
  {
    icon: MessageSquare,
    title: "Patient follow-up",
    description: "Reminds, follows up, and closes the loop after every visit.",
    example: "Reminded 12 patients about labs",
  },
];

export default function AdminGrid() {
  return (
    <section className="relative w-full bg-[#F3F5F4] px-6 py-24 md:py-32">
      <div className="mx-auto w-full max-w-[1600px]">
        {/* Section heading */}
        <div className="mx-auto max-w-3xl text-center">
         
          <h2 className="mt-4 font-[family-name:var(--font-google-sans)] text-[36px] font-normal leading-[1.1] tracking-[-0.01em] text-[#10202E] sm:text-[44px] md:text-[4rem]">
            Six kinds of busywork.
            <br />
            <span className="">Zero on your plate.</span>
          </h2>
        </div>

        {/* 3-across on desktop (3 stacked on 3), collapses to 1 column on mobile */}
        <div className="mt-16 grid grid-cols-1 gap-3 sm:grid-cols-2 md:mt-20 lg:grid-cols-3">
          {CARDS.map(({ icon: Icon, title, description, example }) => (
            <div
              key={title}
              className="group flex min-h-[280px] flex-col rounded-[28px]  bg-white p-8 transition duration-300 md:min-h-[340px] md:p-10"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2F5D50]/10 text-[#2F5D50] transition duration-300 group-hover:bg-[#2F5D50] group-hover:text-white md:h-14 md:w-14">
                <Icon className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" />
              </div>

              <h3 className="mt-6 text-xl font-semibold text-[#10202E] md:text-[22px]">
                {title}
              </h3>

              <p className="mt-3 text-[15px] leading-relaxed text-[#4B5B66] md:text-base">
                {description}
              </p>

              <div className="mt-auto flex items-center gap-2  pt-5 text-sm text-[#4B5B66]">
                <Icon
                  className="h-3.5 w-3.5 shrink-0 text-[#2F5D50]"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <span className="truncate font-medium">{example}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}