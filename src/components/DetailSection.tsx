import Image from "next/image";

export default function DetailSection() {
  return (
    <section className="relative w-full bg-[#f5f2e9] px-5 py-5">
      {/* STUDENTS */}
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
          <div className="flex justify-end">
            <h2 className="max-w-[580px] text-right font-[family-name:var(--font-serif)] text-[clamp(4rem,5vw,7rem)] font-black uppercase leading-[0.82] tracking-[-0.065em]">
              Students
            </h2>
          </div>

          <div className="mt-auto flex justify-end pt-10">
            <p className="max-w-[380px] text-right font-[family-name:var(--font-google-sans)] text-base leading-[1.35] text-black/70">
              The things you love, made better. Fresh ingredients, familiar
              flavors, and more of what makes every meal.
            </p>
          </div>
        </div>
      </div>

      {/* FREELANCERS */}
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
          <div className="flex justify-end">
            <h2 className="max-w-[580px] text-right font-[family-name:var(--font-serif)] text-[clamp(4rem,5vw,7rem)] font-black uppercase leading-[0.82] tracking-[-0.065em]">
              Freelancers
            </h2>
          </div>

          <div className="mt-auto flex justify-end pt-10">
            <p className="max-w-[380px] text-right font-[family-name:var(--font-google-sans)] text-base leading-[1.35] text-black/70">
              The things you love, made better. Fresh ingredients, familiar
              flavors, and more of what makes every meal.
            </p>
          </div>
        </div>
      </div>

      {/* FOR ANYONE */}
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
          <div className="flex justify-end">
            <h2 className="max-w-[580px] text-right font-[family-name:var(--font-serif)] text-[clamp(4rem,5vw,7rem)] font-black uppercase leading-[0.82] tracking-[-0.065em]">
              For Anyone
            </h2>
          </div>

          <div className="mt-auto flex justify-end pt-10">
            <p className="max-w-[380px] text-right font-[family-name:var(--font-google-sans)] text-base leading-[1.35] text-black/70">
              The things you love, made better. Fresh ingredients, familiar
              flavors, and more of what makes every meal.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}