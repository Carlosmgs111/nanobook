import { priceChartProps } from "../../shared/components/priceChart";
import type { ComponentMount } from "../../../rendering/browser/componentRegistry";
import { createPriceChart } from "./createPriceChart";

export const mountPriceChart: ComponentMount = (element, rawProps) => {
  const props = priceChartProps.parse(rawProps);

  const wrapper = document.createElement("figure");
  wrapper.className = "financial-price-chart";
  if (props.title) {
    const caption = document.createElement("figcaption");
    caption.textContent = props.title;
    wrapper.append(caption);
  }
  const canvas = document.createElement("div");
  canvas.style.height = `${props.height}px`;
  wrapper.append(canvas);
  element.replaceChildren(wrapper);

  return createPriceChart(canvas, props);
};
