import { DemoDownload } from "@/components/DemoDownload";
import { Features } from "@/components/Features";
import { Hero } from "@/components/Hero";
import { LocalVoices } from "@/components/LocalVoices";
import { Companions, OfflineOnline } from "@/components/OfflineOnline";
import { ReaderPreview } from "@/components/ReaderPreview";
import { Story } from "@/components/Story";
import { Walkthrough } from "@/components/Walkthrough";

export default function Home() {
  return (
    <>
      <Hero />
      <Story />
      <ReaderPreview />
      <Walkthrough />
      <Features />
      <LocalVoices />
      <OfflineOnline />
      <Companions />
      <DemoDownload />
    </>
  );
}
