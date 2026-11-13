import React, { useState } from "react";

export function LandingAccordion({ items }) {
  return (
    <div>
      {items.map((item) => (
        <AccordionRow key={item.q} item={item} />
      ))}
    </div>
  );
}

function AccordionRow({ item }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border py-5">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-left"
      >
        <span className="font-medium text-foreground">{item.q}</span>
        <span className="text-primary text-xl leading-none">
          {open ? "−" : "+"}
        </span>
      </button>
      {open && (
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-2xl">
          {item.a}
        </p>
      )}
    </div>
  );
}