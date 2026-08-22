export async function POST(request: Request) {
  try {
    const body = await request.json();
    const apiKey = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Resend API key missing in environment' }), { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    const toRecipient = body.to || body.toEmail;
    if (!toRecipient) {
      return new Response(JSON.stringify({ error: 'Prejemnik (to) je obvezen' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const payload: any = {
      from: body.from || 'KCK Organizacija Nedelje <nedelje@kalvarija.si>',
      to: Array.isArray(toRecipient) ? toRecipient : [toRecipient],
      subject: body.subject || 'Povabilo k strežbi - KC Kalvarija',
      html: body.html || body.text || '<p>Živjo!</p><p>Povabilo k sodelovanju pri nedeljskem bogoslužju KC Kalvarija.</p>',
    };

    if (body.text) {
      payload.text = body.text;
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (res.ok) {
      return new Response(JSON.stringify({ success: true, data }), { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    return new Response(JSON.stringify({ error: data.message || 'Resend API napaka', details: data }), {
      status: res.status || 500,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Napaka strežnika' }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}
