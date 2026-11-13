import type { ComponentBlockDefinition } from "../../../../rendering/shared";
import { counterDemoProps } from "./CounterDemo.schema";

export const counterDemoBlock: ComponentBlockDefinition = {
  name: "counter-demo",
  component: "/src/application/browser/components/CounterDemo/CounterDemo.astro",
  props: counterDemoProps,
};
