"use client";

import Image from "next/image";

type AdminCard = {
  title: string;
  description: string;
  example: string;
  // Optional media – provide either image or video (not both)
  image?: string;
  video?: string;
  mediaAlt?: string;
};

const CARDS: AdminCard[] = [
  {
    title: "Declare senders",
    description:
      "Name the wallets that send you support. One or many. Change them anytime.",
    example: "Added mom’s wallet in London",
  },
  {
    title: "Automatic detection",
    description:
      "We watch the chain. Every matching transfer is seen the moment it lands.",
    example: "Detected $180 from sibling",
  },
  {
    title: "Cryptographic proof",
    description:
      "Each transfer is proven on Creditcoin with Attestcoin. No bridge. No oracle to trust.",
    example: "Proof verified on-chain",
  },
  {
    title: "Verified history",
    description:
      "A permanent, on-chain record of every proven remittance. Yours alone.",
    example: "14 transfers recorded",
  },
  {
    title: "Instant decision",
    description:
      "A clear rules engine sets your limit the second new data arrives. No human review.",
    example: "Limit raised to $1,400",
  },
  {
    title: "Draw & repay",
    description:
      "Borrow against your line. Repay over time. Your limit grows with more history.",
    example: "Drew $600 for inventory",
  },
];

export default function AdminGrid() {
  return (
    <section className="relative w-full bg-[#F3F5F4] px-6 py-24 md:py-32">
      <div className="mx-auto w-full max-w-[1600px]">
        {/* Section heading */}
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mt-4 font-[family-name:var(--font-google-sans)] text-[36px] font-normal leading-[1.1] tracking-[-0.01em] text-[#10202E] sm:text-[44px] md:text-[4rem]">
            Six things that finally count.
            <br />
            <span>Zero paperwork.</span>
          </h2>
        </div>

        {/* Cards */}
        <div className="mt-16 grid grid-cols-1 gap-3 sm:grid-cols-2 md:mt-20 lg:grid-cols-3">
          {CARDS.map(({ title, description, image, video, mediaAlt }) => (
            <div
              key={title}
              className="group flex min-h-[280px] flex-col rounded-[28px] bg-white p-8 transition duration-300 md:min-h-[440px] md:p-10"
            >
              <h3 className="text-xl font-semibold text-[#10202E] md:text-[22px]">
                {title}
              </h3>

              <p className="mt-3 text-[15px] leading-relaxed text-[#4B5B66] md:text-base">
                {description}
              </p>

              {/* Media area – appears only when image or video is provided */}
              {(image || video) && (
                <div className="relative mt-8 aspect-[4/3] w-full overflow-hidden rounded-2xl bg-[#F3F5F4]">
                  {video ? (
                    <video
                      src={video}
                      autoPlay
                      muted
                      loop
                      playsInline
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Image
                      src={image!}
                      alt={mediaAlt || title}
                      fill
                      className="object-cover transition duration-500 group-hover:scale-[1.03]"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}