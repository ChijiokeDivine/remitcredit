import Image from "next/image";

export default function DetailSection() {
  return (
    <section className="relative w-full bg-[#f5f2e9] px-5 py-5">
      {/* RECIPIENTS */}
      <div className="sticky top-0 z-10 mx-auto grid min-h-[calc(100vh-40px)] w-full grid-cols-1 overflow-hidden rounded-[20px] lg:grid-cols-[1.03fr_1fr]">
        {/* Image */}
        <div className="relative min-h-[520px] overflow-hidden rounded-[20px] lg:min-h-[calc(100vh-80px)]">
          <Image
            src="/image_3.webp"
            alt="Friends enjoying a meal together outdoors"
            fill
            priority
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 52vw"
          />
        </div>

        {/* Content */}
        <div className="relative flex min-h-[520px] flex-col bg-[#f5f2e9] px-8 py-12 lg:min-h-[calc(100vh-40px)] lg:px-14 xl:px-20">
          <div className="flex justify-center lg:justify-end">
            <h2 className="max-w-[580px] text-center font-[family-name:var(--font-serif)] text-[clamp(2.6rem,4.6vw,7rem)] font-black uppercase leading-[0.82] tracking-[-0.065em] lg:text-right">
              Recipients
            </h2>
          </div>

          <div className="flex justify-center pt-10 lg:justify-end">
            <p className="max-w-[380px] text-center font-[family-name:var(--font-google-sans)] text-base leading-[1.35] text-black/70 lg:text-right">
              You already receive regular support from family abroad.
              RemitCredit turns that history into a credit line you can actually use.
            </p>
          </div>
        </div>
      </div>

      {/* SENDERS */}
      <div className="sticky top-0 z-20 mx-auto grid min-h-[calc(100vh-40px)] w-full grid-cols-1 overflow-hidden rounded-[20px] lg:grid-cols-[1.03fr_1fr]">
        {/* Image */}
        <div className="relative min-h-[520px] overflow-hidden rounded-[20px] lg:min-h-[calc(100vh-80px)]">
          <Image
            src="/image_1.webp"
            alt="Friends enjoying a meal together outdoors"
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 52vw"
          />
        </div>

        {/* Content */}
        <div className="relative flex min-h-[520px] flex-col bg-[#f5f2e9] px-8 py-12 lg:min-h-[calc(100vh-40px)] lg:px-14 xl:px-20">
          <div className="flex justify-center lg:justify-end">
            <h2 className="max-w-[580px] text-center font-[family-name:var(--font-serif)] text-[clamp(2.6rem,4.6vw,7rem)] font-black uppercase leading-[0.82] tracking-[-0.065em] lg:text-right">
              Senders
            </h2>
          </div>

          <div className="flex justify-center pt-10 lg:justify-end">
            <p className="max-w-[380px] text-center font-[family-name:var(--font-google-sans)] text-base leading-[1.35] text-black/70 lg:text-right">
              Keep sending exactly as you do now.
              Your transfers quietly build credit for the person you support.
              No new steps. No new apps.
            </p>
          </div>
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div className="sticky top-0 z-30 mx-auto grid min-h-[calc(100vh-40px)] w-full grid-cols-1 overflow-hidden rounded-[20px] lg:grid-cols-[1.03fr_1fr]">
        {/* Image */}
        <div className="relative min-h-[520px] overflow-hidden rounded-[20px] lg:min-h-[calc(100vh-80px)]">
          <Image
            src="/image_2.webp"
            alt="Friends enjoying a meal together outdoors"
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 52vw"
          />
        </div>

        {/* Content */}
        <div className="relative flex min-h-[520px] flex-col bg-[#f5f2e9] px-8 py-12 lg:min-h-[calc(100vh-40px)] lg:px-14 xl:px-20">
          <div className="flex justify-center lg:justify-end">
            <h2 className="max-w-[580px] text-center font-[family-name:var(--font-serif)] text-[clamp(2.6rem,4.6vw,7rem)] font-black uppercase leading-[0.82] tracking-[-0.065em] lg:text-right">
              How it works
            </h2>
          </div>

          <div className="flex justify-center pt-10 lg:justify-end">
            <p className="max-w-[380px] text-center font-[family-name:var(--font-google-sans)] text-base leading-[1.35] text-black/70 lg:text-right">
              Declare senders. We detect and prove every transfer.
              A transparent engine sets your limit.
              You borrow when you need it.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}