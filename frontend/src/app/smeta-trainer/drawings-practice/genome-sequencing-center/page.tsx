"use client";
import Link from "next/link";
import { useState } from "react";

export default function GenomeSequencingCenterPage() {
  const [ex1, setEx1] = useState(""); const [ex2, setEx2] = useState(""); const [ex3, setEx3] = useState(""); const [ex4, setEx4] = useState(""); const [showResults, setShowResults] = useState(false);
  const e2 = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const e2OK = !isNaN(e2) && Math.abs(e2 - 100_000) <= 10_000;
  const e3 = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const e3OK = !isNaN(e3) && Math.abs(e3 - 18_000_000_000) <= 1_800_000_000;
  const ok = { ex1: ex1 === "d", ex2: e2OK, ex3: e3OK, ex4: ex4 === "c" };
  const score = Object.values(ok).filter(Boolean).length;
  const oc = (s: string, v: string, isok: boolean) => !showResults || s !== v ? (s === v ? "border-blue-500 bg-blue-500/20" : "border-slate-700 hover:border-slate-500") : isok ? "border-emerald-500 bg-emerald-500/20" : "border-rose-500 bg-rose-500/20";
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10"><div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between"><Link href="/smeta-trainer/drawings-practice" className="text-sm text-blue-300">← К разделам</Link><div className="text-xs text-slate-500">Genome Sequencing Center</div></div></header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section><h1 className="text-3xl md:text-4xl font-bold">🧬 Геномный секвенирующий центр (NGS)</h1>
          <p className="mt-3 text-slate-400 max-w-3xl">Модуль #313. National Center of Biotechnology Astana — план «Kazakhstan Genome Initiative» secвенирования 100K-1M казахов для precision medicine. Reference: Beijing Genome Institute BGI Shenzhen 100M+ genomes/year, Sanger Cambridge UK, Broad MIT Cambridge USA. Technology — Illumina NovaSeq 6000 + X 1.5 TB output per run + PacBio Sequel IIe long-read 25 kb avg. Bioinformatics HPC cluster для variant calling + annotation. CLIA + GA4GH Standards + ISO 17025 + СН РК 4.04-09.</p>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав genomics center 100 000 samples/year</h2>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li>Sample receiving + accession — barcode scanner Mettler + Aliquot Robotic Hamilton STAR 16-channel × 4;</li>
            <li>DNA extraction lab — QIAGEN QIAcube + Promega Maxwell automated 96-well, output 5-10 μg DNA/sample;</li>
            <li>Library prep — Illumina TruSeq Nano + KAPA HyperPlus automated с Beckman Coulter Biomek FX;</li>
            <li>Sequencing lab — Illumina NovaSeq 6000 × 4 instruments + NovaSeq X 8 instruments (1.5-3 TB/run);</li>
            <li>Long-read PacBio Sequel IIe × 2 + Oxford Nanopore PromethION для structural variants;</li>
            <li>HPC cluster — Dell PowerEdge R750 server 64-core EPYC × 100 nodes + GPU NVIDIA A100 × 50 для variant calling GATK4 + alignment BWA-MEM2;</li>
            <li>Storage — 10 PB Dell EMC Isilon scale-out NAS + 50 PB tape archive long-term;</li>
            <li>Bioinformatics workflow — Nextflow + Snakemake pipelines + AWS Genomics CLI для cloud burst;</li>
            <li>QC lab — Bioanalyzer Agilent 2100 + qPCR Roche LightCycler 480;</li>
            <li>Cold storage — -80 °C ULT freezer × 50 для DNA + RNA + bio-samples;</li>
            <li>Genetics counselling room + clinical reporting team для returning results to patients;</li>
            <li>Variant database GenomicsKZ + integration с ClinVar / dbSNP / gnomAD + protected access GA4GH Beacon;</li>
            <li>Cybersecurity HIPAA compliance + encrypted at-rest + at-transit AES-256;</li>
            <li>Power 1 МВт + UPS 200 kVA + DG 500 kVA backup для 24/7 sequencing runs;</li>
            <li>Adjacent biobank Air Liquide LD-5K LN2 storage 1M sample plasma/tissue.</li>
          </ul>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Sequencing technology</h2>
          <div className="space-y-2">{[
            { v: "a", t: "Только Sanger sequencing 3500 ABI" },
            { v: "b", t: "Только microarray Affymetrix" },
            { v: "c", t: "Только qPCR Roche" },
            { v: "d", t: "Mixed NGS short-read + long-read для population genomics per Broad/Sanger/BGI best practices: (1) Illumina NovaSeq X primary workhorse — 2×150 bp short reads, 30× coverage WGS Whole Genome Sequencing $200-300 per sample, throughput 16 TB/week per instrument; (2) PacBio HiFi Sequel IIe long-read 10-25 kb для structural variants + phasing diploid genome + repeat expansion disorders (Huntington, ALS); (3) Oxford Nanopore PromethION ultra-long 100 kb-1 Mb для T2T telomere-to-telomere assembly + epigenetics methylation; (4) Optical mapping Bionano Saphyr для cytogenetics chromosomal abnormalities; (5) Bioinformatics — GATK4 variant calling + DeepVariant ML + VEP annotation + ClinVar interpretation; (6) HPC scale — 100 000 WGS = 3 PB raw data, processing 100-500 CPU-hours per sample, $50-100 per sample compute cost; (7) Population studies — Kazakhstan Genome Initiative could identify novel CV/cancer/metabolic risk variants для precision medicine. GA4GH Standards + CLIA + Broad Institute Best Practices" },
          ].map((o) => (<label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${oc(ex1, o.v, ok.ex1)}`}><input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />{o.t}</label>))}</div>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Samples/year</h2>
          <input type="text" value={ex2} onChange={(e) => setEx2(e.target.value)} placeholder="штук" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${ok.ex2 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p><strong>~100 000 samples/year</strong> при 12 NovaSeq instruments × 300 runs × ~30 samples/run.</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Капекс genomics center</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>Illumina NovaSeq 6000 × 4 + X × 8 = 7 млрд</li>
            <li>PacBio Sequel IIe × 2 + Nanopore PromethION × 4 = 2 млрд</li>
            <li>HPC cluster Dell PowerEdge 100 nodes + GPU A100 × 50 = 4 млрд</li>
            <li>Storage Dell EMC Isilon 10 PB + tape 50 PB = 1.5 млрд</li>
            <li>Sample prep robotics Hamilton STAR + Beckman + QIAcube = 0.8 млрд</li>
            <li>QC + biobank LN2 + cold storage = 0.7 млрд</li>
            <li>Building 3000 м² + cleanroom + проектирование 4% + insurance = 2 млрд</li>
          </ul>
          <input type="text" value={ex3} onChange={(e) => setEx3(e.target.value)} placeholder="тг" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${ok.ex3 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p><strong>~18 млрд тг (~$38M USD)</strong> для 100K samples/year genomics center.</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Data security</h2>
          <div className="space-y-2">{[
            { v: "a", t: "Простой пароль на сервер" },
            { v: "b", t: "Только бэкап на USB" },
            { v: "c", t: "Multi-layer security per HIPAA + GA4GH + ISO 27001: (1) at-rest encryption AES-256 на all storage volumes; (2) at-transit TLS 1.3 + IPSEC VPN для inter-facility transfers; (3) RBAC role-based access — researchers see only de-identified, clinicians see full identifiable, biobank only metadata; (4) data minimisation — share aggregate statistics only via GA4GH Beacon API, not raw genomes; (5) participant consent management Salesforce Health Cloud + dynamic re-consent; (6) audit trail все access events ImmuDB blockchain ledger; (7) penetration test annual + bug bounty program; (8) ISO 27001 certification + SOC 2 Type II + GA4GH Beacon Network membership; (9) genome data special category personal data EU GDPR + Закон РК О персональных данных; HIPAA + GDPR + GA4GH Standards + ISO 27001 + FIPS 140-2 + Закон РК Об охране здоровья" },
            { v: "d", t: "Открытая публикация всех данных" },
          ].map((o) => (<label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${oc(ex4, o.v, ok.ex4)}`}><input type="radio" name="ex4" value={o.v} checked={ex4 === o.v} onChange={() => setEx4(o.v)} className="mr-3" />{o.t}</label>))}</div>
        </section>
        <button onClick={() => setShowResults(true)} className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-lg font-semibold">Проверить ответы</button>
        {showResults && <section className={`p-6 rounded-xl border-2 ${score === 4 ? "border-emerald-500 bg-emerald-500/10" : score >= 2 ? "border-amber-500 bg-amber-500/10" : "border-rose-500 bg-rose-500/10"}`}><h2 className="text-2xl font-bold">Результат: {score} / 4</h2></section>}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3"><h2 className="text-xl font-semibold text-cyan-300">Нормативная база</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>CLIA Clinical Laboratory Improvement Amendments</li>
            <li>GA4GH Global Alliance for Genomics and Health Standards</li>
            <li>HIPAA Health Insurance Portability + Accountability</li>
            <li>EU GDPR General Data Protection Regulation</li>
            <li>ISO 15189 — Medical Laboratory Quality</li>
            <li>ISO 17025 — Testing + Calibration Lab</li>
            <li>ISO 27001 — Information Security</li>
            <li>FIPS 140-2 — Cryptography</li>
            <li>Закон РК О персональных данных</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
