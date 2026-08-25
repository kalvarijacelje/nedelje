import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv, type Plugin } from 'vite';

// Auto-sync PWA and master logo files in public folder
try {
  const masterLogo = path.resolve(__dirname, '../kck/public/KCK-logo-rdec_small.png');
  const masterSecondary = path.resolve(__dirname, '../kck/public/KCK-logo-rdec-sekundaren_small.png');
  const targetDir = path.resolve(__dirname, 'public');

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  if (fs.existsSync(masterLogo)) {
    fs.copyFileSync(masterLogo, path.join(targetDir, 'KCK-logo-rdec_small.png'));
  }
  if (fs.existsSync(masterSecondary)) {
    fs.copyFileSync(masterSecondary, path.join(targetDir, 'KCK-logo-rdec-sekundaren_small.png'));
  }

  const logoPath = path.resolve(__dirname, 'public/kck-logo-rdec-sekundaren.png');
  const icon192 = path.resolve(__dirname, 'public/pwa-192x192.png');
  const icon512 = path.resolve(__dirname, 'public/pwa-512x512.png');
  if (fs.existsSync(logoPath)) {
    if (!fs.existsSync(icon192)) fs.copyFileSync(logoPath, icon192);
    if (!fs.existsSync(icon512)) fs.copyFileSync(logoPath, icon512);
  }
} catch (e) {
  // ignore
}

/**
 * Local dev server middleware for /api/send-email (bypasses browser CORS restrictions)
 */
function apiEmailDevPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'api-email-dev-plugin',
    configureServer(server) {
      server.middlewares.use('/api/send-email', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method Not Allowed' }));
          return;
        }

        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });

        req.on('end', async () => {
          try {
            const parsed = JSON.parse(body || '{}');
            const apiKey = env.RESEND_API_KEY || env.VITE_RESEND_API_KEY || process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY;

            if (!apiKey) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Resend API key missing in local dev environment' }));
              return;
            }

            const toRecipient = parsed.to || parsed.toEmail;
            if (!toRecipient) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Prejemnik (to) je obvezen' }));
              return;
            }

            const payload: any = {
              from: parsed.from || 'KCK Organizacija Nedelje <nedelje@kalvarija.si>',
              to: Array.isArray(toRecipient) ? toRecipient : [toRecipient],
              subject: parsed.subject || 'Povabilo k strežbi - KC Kalvarija',
              html: parsed.html || parsed.text || '<p>Povabilo k strežbi</p>',
            };
            if (parsed.text) {
              payload.text = parsed.text;
            }

            const resendRes = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
              },
              body: JSON.stringify(payload),
            });

            const data = await resendRes.json();
            res.statusCode = resendRes.status;
            res.setHeader('Content-Type', 'application/json');
            if (resendRes.ok) {
              res.end(JSON.stringify({ success: true, data }));
            } else {
              res.end(JSON.stringify({ error: data.message || 'Resend error', details: data }));
            }
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
          }
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss(), apiEmailDevPlugin(env)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
