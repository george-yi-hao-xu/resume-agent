export const initialPreviewHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        color: #1f2937;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #e5e7eb;
      }
      .resume {
        width: min(900px, calc(100vw - 48px));
        min-height: 1120px;
        margin: 32px auto;
        padding: 56px;
        background: #ffffff;
        box-shadow: 0 24px 70px rgba(31, 41, 55, 0.16);
      }
      .resume-header {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 24px;
        align-items: start;
        padding-bottom: 28px;
        border-bottom: 2px solid #111827;
      }
      .resume-name {
        margin: 0;
        color: #111827;
        font-size: 42px;
        line-height: 1;
        letter-spacing: 0;
      }
      .resume-title {
        margin: 10px 0 0;
        color: #2563eb;
        font-size: 18px;
        font-weight: 800;
      }
      .contact-list {
        display: grid;
        gap: 7px;
        margin: 0;
        color: #4b5563;
        font-size: 13px;
        text-align: right;
      }
      .resume-section {
        padding: 26px 0 0;
      }
      .section-title {
        margin: 0 0 14px;
        color: #111827;
        font-size: 13px;
        font-weight: 900;
        letter-spacing: 0;
        text-transform: uppercase;
      }
      .summary-text {
        margin: 0;
        color: #374151;
        font-size: 16px;
        line-height: 1.65;
      }
      .experience-list,
      .project-list {
        display: grid;
        gap: 20px;
      }
      .resume-item h3 {
        margin: 0;
        color: #111827;
        font-size: 18px;
      }
      .resume-meta {
        margin: 5px 0 10px;
        color: #6b7280;
        font-size: 13px;
        font-weight: 700;
      }
      .bullet-list {
        margin: 0;
        padding-left: 20px;
        color: #374151;
        line-height: 1.55;
      }
      .skills-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .skills-list li {
        border: 1px solid #d1d5db;
        border-radius: 999px;
        padding: 7px 10px;
        color: #1f2937;
        background: #f9fafb;
        font-size: 13px;
        font-weight: 700;
      }
      @media (max-width: 720px) {
        .resume {
          width: 100%;
          min-height: 100vh;
          margin: 0;
          padding: 28px;
          box-shadow: none;
        }
        .resume-header {
          grid-template-columns: 1fr;
        }
        .contact-list {
          text-align: left;
        }
        .resume-name {
          font-size: 34px;
        }
      }
    </style>
  </head>
  <body>
    <main class="resume" data-resume-root>
      <header class="resume-header">
        <div>
          <h1 class="resume-name">Alex Chen</h1>
          <p class="resume-title">Full-Stack Engineer</p>
        </div>
        <address class="contact-list">
          <span class="contact-email">alex.chen@example.com</span>
          <span class="contact-phone">+1 415 555 0198</span>
          <span class="contact-location">San Francisco, CA</span>
          <span class="contact-portfolio">alexchen.dev</span>
        </address>
      </header>

      <section class="resume-section summary-section">
        <h2 class="section-title">Summary</h2>
        <p class="summary-text">Product-minded full-stack engineer with 6 years of experience building web applications, internal tools, and AI-assisted workflows.</p>
      </section>

      <section class="resume-section experience-section">
        <h2 class="section-title">Experience</h2>
        <div class="experience-list">
          <article class="resume-item experience-item">
            <h3 class="job-title">Senior Software Engineer, Northstar Labs</h3>
            <p class="resume-meta">2022 - Present · San Francisco, CA</p>
            <ul class="bullet-list">
              <li>Led development of a React and TypeScript analytics workspace used by operations teams.</li>
              <li>Designed API integrations that reduced manual reporting time by 40%.</li>
              <li>Partnered with product and design to ship iterative improvements every week.</li>
            </ul>
          </article>
          <article class="resume-item experience-item">
            <h3 class="job-title">Software Engineer, BrightDesk</h3>
            <p class="resume-meta">2019 - 2022 · Remote</p>
            <ul class="bullet-list">
              <li>Built customer-facing dashboards with React, Node.js, and PostgreSQL.</li>
              <li>Improved page load performance and reliability across core account workflows.</li>
            </ul>
          </article>
        </div>
      </section>

      <section class="resume-section skills-section">
        <h2 class="section-title">Skills</h2>
        <ul class="skills-list">
          <li>React</li>
          <li>TypeScript</li>
          <li>Node.js</li>
          <li>PostgreSQL</li>
          <li>MobX</li>
          <li>LLM Tooling</li>
        </ul>
      </section>

      <section class="resume-section project-section">
        <h2 class="section-title">Projects</h2>
        <div class="project-list">
          <article class="resume-item project-item">
            <h3>AI Resume Editor</h3>
            <p class="summary-text">Prototype editor that converts natural language requests into safe structured DOM patches.</p>
          </article>
        </div>
      </section>
    </main>
  </body>
</html>`;
