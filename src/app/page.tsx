import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/hero/Hero";
import { Steps } from "@/components/sections/Steps";
import { Stream } from "@/components/sections/Stream";
import { Differentiators } from "@/components/sections/Differentiators";
import { Money } from "@/components/sections/Money";
import { Faq } from "@/components/sections/Faq";
import { Closer } from "@/components/sections/Closer";
import { SplashScreen } from "@/components/SplashScreen";
import { GlobalBackground } from "@/components/GlobalBackground";

export default function Home() {
  return (
    <>
      <SplashScreen />
      <GlobalBackground />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-accent focus:px-5 focus:py-3 focus:font-semibold focus:text-ink"
      >
        Skip to content
      </a>
      <div className="page-content">
        <Nav />
        <main id="main">
          <Hero />
          <Steps />
          <Stream />
          <Differentiators />
          <Money />
          <Faq />
          <Closer />
        </main>
        <Footer onHome />
      </div>
    </>
  );
}
