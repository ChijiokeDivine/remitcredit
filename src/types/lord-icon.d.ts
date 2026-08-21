import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare module "react/jsx-runtime" {
  namespace JSX {
    interface IntrinsicElements {
      "lord-icon": DetailedHTMLProps<
        HTMLAttributes<HTMLElement> & {
          src?: string;
          trigger?:
            | "hover"
            | "click"
            | "loop"
            | "loop-on-hover"
            | "morph"
            | "boomerang"
            | "in"
            | "sequence";
          colors?: string;
          stroke?: string;
          state?: string;
          target?: string;
          delay?: string | number;
          speed?: string | number;
          loading?: "lazy" | "eager";
        },
        HTMLElement
      >;
    }
  }
}