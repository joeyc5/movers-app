import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";

export function Default() {
  return (
    <Accordion type="single" collapsible defaultValue="scope" className="w-full max-w-md">
      <AccordionItem value="scope">
        <AccordionTrigger>Scope of work</AccordionTrigger>
        <AccordionContent>
          Full-service packing on the origin side, unpack of kitchen and primary bedroom only.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="access">
        <AccordionTrigger>Access notes</AccordionTrigger>
        <AccordionContent>
          Third floor walk-up, no elevator. Loading zone permit filed for 7am.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="valuation">
        <AccordionTrigger>Valuation</AccordionTrigger>
        <AccordionContent>Full value protection at $60,000 declared.</AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
