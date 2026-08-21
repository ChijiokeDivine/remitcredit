"use client";

import { useEffect } from "react";
import { defineElement } from "@lordicon/element";
import Image from "next/image";

type AdminCard = {
  title: string;
  description: string;
  example: string;
  // Media – use only one of these three
  image?: string;
  video?: string;
  lordicon?: string; // CDN JSON URL (free icons only)
  mediaAlt?: string;
};

const CARDS: AdminCard[] = [
  {
    title: "Declare senders",
    description:
      "Name the wallets that send you support. One or many. Change them anytime.",
    example: "Added mom’s wallet in London",
    video: "/videos/4492649-hd_1280_720_50fps.mp4",
    mediaAlt: "Declare senders",
    // Wallet / money bag – free
    lordicon: "https://cdn.lordicon.com/vaeagfzc.json",
  },
  {
    title: "Automatic detection",
    description:
      "We watch the chain. Every matching transfer is seen the moment it lands.",
    example: "Detected $180 from sibling",
    // Search / detection – free
    lordicon: "https://cdn.lordicon.com/ntfnmkcn.json",
  },
  {
    title: "Cryptographic proof",
    description:
      "Each transfer is proven on Creditcoin with Attestcoin. No bridge. No oracle to trust.",
    example: "Proof verified on-chain",
    // Shield / lock – free
    lordicon: "https://cdn.lordicon.com/rhmhivzj.json",
  },
  {
    title: "Verified history",
    description:
      "A permanent, on-chain record of every proven remittance. Yours alone.",
    example: "14 transfers recorded",
    // Document / history – free
    lordicon: "https://cdn.lordicon.com/hnqamtrw.json",
  },
  {
    title: "Instant decision",
    description:
      "A clear rules engine sets your limit the second new data arrives. No human review.",
    example: "Limit raised to $1,400",
    // Lightning / speed – free
    image: "https://media.lordicon.com/icons/wired/flat/35-pencil.gif",
    mediaAlt: "Instant decision",
    lordicon: "https://cdn.lordicon.com/wloilxuq.json",
  },
  {
    title: "Draw & repay",
    description:
      "Borrow against your line. Repay over time. Your limit grows with more history.",
    example: "Drew $600 for inventory",
    // Money / transfer – free
    video: "/videos/0_Man_Robe_1920x1080.mp4",
    mediaAlt: "Draw & repay",
    lordicon: "https://cdn.lordicon.com/zpxybbop.json",
  },
];

export default function AdminGrid() {
  useEffect(() => {
    defineElement();
  }, []);

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
          {CARDS.map(({ title, description, image, video, lordicon, mediaAlt }) => (
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

              {/* Media area – image | video | lordicon */}
              {(image || video || lordicon) && (
                <div className="relative mt-8 flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-2xl">
                  {video ? (
                    <video
                      src={video}
                      autoPlay
                      muted
                      loop
                      playsInline
                      className="h-full w-full object-cover"
                    />
                  ) : image ? (
                    <Image
                      src={image}
                      alt={mediaAlt || title}
                      width={100}
                      height={100}
                      className="object-cover transition duration-500"
                    />
                  ) : (
                    <lord-icon
                      src={lordicon}
                      trigger="hover"
                      target="div.group" // animates when the whole card is hovered
                    
                      style={{ width: "120px", height: "120px" }}
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