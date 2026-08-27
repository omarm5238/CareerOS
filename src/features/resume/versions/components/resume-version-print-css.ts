/**
 * Print rules for the tailored resume.
 * Only `.resume-version-print` reaches paper: app chrome, actions, keyword map,
 * warnings, evidence notes, change log, and AI metadata are excluded by design.
 */
export const RESUME_VERSION_PRINT_CSS = `
.resume-version-print {
  display: none;
}

@page {
  size: A4;
  margin: 16mm;
}

@media print {
  html, body {
    background: #fff !important;
    color: #111 !important;
  }

  body * {
    visibility: hidden;
  }

  .resume-version-print,
  .resume-version-print * {
    visibility: visible;
  }

  .no-print {
    display: none !important;
    visibility: hidden !important;
  }

  .resume-version-print {
    display: block;
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    max-width: 178mm;
    margin: 0 auto;
    padding: 0;
    color: #111 !important;
    background: #fff !important;
    font-size: 10.5pt;
    line-height: 1.45;
  }

  .resume-version-print__header {
    border-bottom: 1px solid #bbb;
    padding-bottom: 4mm;
    margin-bottom: 5mm;
  }

  .resume-version-print h1 {
    font-size: 18pt;
    font-weight: 600;
    letter-spacing: -0.01em;
    margin: 0;
    color: #111 !important;
  }

  .resume-version-print .resume-version-print__role {
    margin: 1.5mm 0 0;
    font-size: 11pt;
    color: #444 !important;
  }

  .resume-version-print section {
    break-inside: avoid;
    page-break-inside: avoid;
    margin-bottom: 5mm;
  }

  .resume-version-print h2 {
    font-size: 9.5pt;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #333 !important;
    border-bottom: 1px solid #ddd;
    padding-bottom: 1.5mm;
    margin: 0 0 2.5mm;
  }

  .resume-version-print p {
    margin: 0;
    color: #111 !important;
  }

  .resume-version-print ul {
    margin: 0;
    padding-left: 5mm;
    list-style: disc;
  }

  .resume-version-print li {
    margin-bottom: 1.5mm;
    color: #111 !important;
  }

  .resume-version-print strong {
    font-weight: 600;
  }
}
`;
