"use client";

import React from "react";
import Image from "next/image";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import { FileText, Zap } from "lucide-react";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1400&q=80";

export function HeroScrollSection() {
  return (
    <div className="flex flex-col overflow-hidden pb-[300px] pt-[60vh]">
      <ContainerScroll
        titleComponent={
          <>
            <h2 className="text-3xl font-semibold text-white sm:text-4xl">
              Invoices, escrow & payments
              <br />
              <span className="mt-2 inline-flex items-center gap-2 text-3xl font-bold text-teal-400 sm:text-4xl md:text-5xl">
                <FileText className="h-8 w-8 md:h-10 md:w-10" />
                One platform
                <Zap className="h-7 w-7 text-amber-400 md:h-8 md:w-8" />
              </span>
            </h2>
          </>
        }
      >
        <Image
          src={HERO_IMAGE}
          alt="HoldisPay dashboard and payments"
          height={720}
          width={1400}
          className="mx-auto rounded-2xl object-cover h-full object-top-left"
          draggable={false}
        />
      </ContainerScroll>
    </div>
  );
}
