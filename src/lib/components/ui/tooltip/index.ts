import { Tooltip as TooltipPrimitive } from 'bits-ui';

const Root = TooltipPrimitive.Root;
const Trigger = TooltipPrimitive.Trigger;
const Provider = TooltipPrimitive.Provider;

export {
	Root,
	Trigger,
	Provider,
	//
	Root as Tooltip
};

export { default as Content } from './tooltip-content.svelte';
