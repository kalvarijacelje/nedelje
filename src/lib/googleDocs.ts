/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ServiceSunday, Ministry, Person, MinistryAssignment } from '../types';
import { resolveMinistryAssignments } from '../utils/worshipSync';

export interface DocGenerationResult {
  documentId: string;
  documentUrl: string;
  title: string;
}

// Helper builder to track characters and indexes for styling
class DocumentBuilder {
  private text: string = '';
  private styles: Array<{
    start: number;
    end: number;
    type: 'title' | 'h1' | 'h2' | 'bold' | 'italic' | 'bullet';
  }> = [];

  append(str: string) {
    this.text += str;
  }

  appendLine(str: string = '') {
    this.text += str + '\n';
  }

  appendStyled(str: string, type: 'title' | 'h1' | 'h2' | 'bold' | 'italic' | 'bullet') {
    // google doc index is 1-based, we keep track of the indexes relative to UTF-16 characters
    const start = this.text.length + 1;
    this.text += str;
    const end = this.text.length + 1;
    this.styles.push({ start, end, type });
  }

  appendStyledLine(str: string, type: 'title' | 'h1' | 'h2' | 'bold' | 'italic' | 'bullet') {
    this.appendStyled(str, type);
    this.text += '\n';
  }

  getText() {
    return this.text;
  }

  getStyles() {
    return this.styles;
  }
}

/**
 * Creates a beautiful, customized Google Doc template based on selected service details.
 */
export async function generateGoogleDoc(
  accessToken: string,
  sunday: ServiceSunday,
  docType: 'service_plan' | 'worship_meet' | 'briefing_sheet' | 'volunteers' | 'archive_note',
  language: 'sl' | 'en',
  ministries: Ministry[],
  people: Person[]
): Promise<DocGenerationResult> {
  const isSl = language === 'sl';

  // 1. Determine Title
  let docTitle = '';
  switch (docType) {
    case 'service_plan':
      docTitle = isSl 
        ? `Poln Interni Načrt Bogoslužja - ${sunday.date}` 
        : `Full Internal Service Plan - ${sunday.date}`;
      break;
    case 'worship_meet':
      docTitle = isSl 
        ? `Scenarij za Ekipo za Slavljenje - ${sunday.date}` 
        : `Worship Team Run Sheet - ${sunday.date}`;
      break;
    case 'briefing_sheet':
      docTitle = isSl 
        ? `Navodila za Pridigarja in Voditelja - ${sunday.date}` 
        : `Preacher and Host Briefing Sheet - ${sunday.date}`;
      break;
    case 'volunteers':
      docTitle = isSl 
        ? `Razpored Sodelavcev in Služb - ${sunday.date}` 
        : `Volunteer Coordination Sheet - ${sunday.date}`;
      break;
    case 'archive_note':
      docTitle = isSl 
        ? `Arhivsko Poročilo Bogoslužja - ${sunday.date}` 
        : `Post-Service Summary Archive Note - ${sunday.date}`;
      break;
  }

  // 2. Initialize the DocumentBuilder
  const builder = new DocumentBuilder();

  // Document Heading
  builder.appendStyledLine(docTitle.toUpperCase(), 'title');
  builder.appendLine('========================================================================');
  builder.appendLine();

  // Helper to resolve assigned people
  const getAssignmentsList = (ministryId: string): string => {
    const names = resolveMinistryAssignments(sunday, ministryId);
    if (names.length === 0) return isSl ? 'ni dodeljenega sodelavca' : 'no scheduled volunteer';

    const details = sunday.assignmentDetails?.[ministryId] || [];
    return names.map(name => {
      const detail = details.find(d => d.personName === name);
      const statusSuffix = detail ? ` (${detail.status === 'confirmed' ? (isSl ? 'potrjeno' : 'confirmed') : detail.status === 'declined' ? (isSl ? 'zavrnjeno' : 'declined') : (isSl ? 'v čakanju' : 'pending')})` : '';
      const notesSuffix = detail?.notes ? ` - "${detail.notes}"` : '';
      return `${name}${statusSuffix}${notesSuffix}`;
    }).join(', ');
  };

  // Helper for adding section title
  const addSectionHeader = (titleSl: string, titleEn: string) => {
    builder.appendLine();
    builder.appendStyledLine(isSl ? titleSl.toUpperCase() : titleEn.toUpperCase(), 'h1');
    builder.appendLine('------------------------------------------------------------------------');
  };

  // Section: General Service details
  addSectionHeader('1. Splošni podatki o nedelji', '1. General Service Details');
  
  builder.appendStyled(isSl ? 'Datum bogoslužja: ' : 'Service Date: ', 'bold');
  builder.appendLine(sunday.date);
  
  builder.appendStyled(isSl ? 'Tema / Pridiga (SLO): ' : 'Sermon Topic (SLO): ', 'bold');
  builder.appendLine(sunday.themeSl || '/');
  
  builder.appendStyled(isSl ? 'Tema / Pridiga (ENG): ' : 'Sermon Topic (ENG): ', 'bold');
  builder.appendLine(sunday.themeEn || '/');
  
  builder.appendStyled(isSl ? 'Gost / Pridigar: ' : 'Preacher / Guest Speaker: ', 'bold');
  builder.appendLine(sunday.guest || (isSl ? 'Domači govornik / Ni gosta' : 'Local Speaker / No Guest'));
  
  builder.appendStyled(isSl ? 'Stanje načrtovanja: ' : 'Planning Status: ', 'bold');
  builder.appendLine(sunday.status.toUpperCase());

  // Generate template-specific content based on selected docType
  if (docType === 'service_plan') {
    // Template 1: Full Internal Service Plan
    addSectionHeader('2. Razpored vseh služb in zadolžitev', '2. Complete Ministry Assignments');
    
    // Group ministries by category for clean structure
    const categories: Record<string, { nameSl: string; nameEn: string; list: Ministry[] }> = {
      sermon_prayer: { nameSl: 'Pridiga in molitev', nameEn: 'Word & Prayer', list: [] },
      av_tech: { nameSl: 'A/V & Tehnična podpora', nameEn: 'A/V & Tech Support', list: [] },
      hospitality: { nameSl: 'Sprejem in druženje', nameEn: 'Hosting & Hospitality', list: [] },
      kids: { nameSl: 'Otroški program (Sunday school)', nameEn: 'Kids Ministry', list: [] },
      cleaning: { nameSl: 'Ureditev prostora', nameEn: 'Setup & Cleaning', list: [] },
      other: { nameSl: 'Drugo', nameEn: 'Other Ministries', list: [] },
    };

    ministries.forEach(min => {
      if (categories[min.category]) {
        categories[min.category].list.push(min);
      } else {
        categories.other.list.push(min);
      }
    });

    Object.entries(categories).forEach(([key, cat]) => {
      if (cat.list.length === 0) return;
      builder.appendLine();
      builder.appendStyledLine(isSl ? cat.nameSl : cat.nameEn, 'h2');
      
      cat.list.forEach(min => {
        builder.appendStyled(`  • ${isSl ? min.nameSl : min.nameEn}: `, 'bold');
        builder.appendLine(getAssignmentsList(min.id));
      });
    });

    addSectionHeader('3. Organizacijske opombe in odsotnosti', '3. Roster Notes & Absent Members');
    builder.appendStyledLine(isSl ? 'Opombe iz baze planerja:' : 'Roster notes from the database:', 'italic');
    builder.appendLine(sunday.absentOrNotes || (isSl ? '(Ni vnesenih specifičnih opomb)' : '(No custom notes provided)'));
    
    addSectionHeader('4. Časovnica in potek nedeljskega jutra', '4. Morning Timeline & Logistics Grid');
    if (isSl) {
      builder.appendLine('08:30 - Prihod tehnične ekipe (nastavitev zvoka, projekcije in prenosa v živo)');
      builder.appendLine('09:00 - Prihod glasbene ekipe za slavljenje & zvočna vaja');
      builder.appendLine('09:30 - Kratka molitev celotne ekipe v pisarni (vsi sodelavci na razporedu)');
      builder.appendLine('09:45 - Odprtje vrat, sprejem obiskovalcev in kratek pregled prostora');
      builder.appendLine('10:00 - Začetek bogoslužja (slavljenje, pozdrav, pridiga, odziv)');
      builder.appendLine('11:30 - Konec uradnega dela, druženje ob kavi in čaju, pospravljanje');
    } else {
      builder.appendLine('08:30 - Tech team arrival (mixing board, slides, camera and streaming checks)');
      builder.appendLine('09:00 - Worship team arrival & full stage soundcheck');
      builder.appendLine('09:30 - Short team prayer meeting in the office (all active roster volunteers)');
      builder.appendLine('09:45 - Doors open, welcoming visitors, final lobby safety inspection');
      builder.appendLine('10:00 - Sunday service starts (opening praise, welcoming, sermon, response)');
      builder.appendLine('11:30 - Post-service fellowship, coffee & tea segment, tidying up');
    }

  } else if (docType === 'worship_meet') {
    // Template 2: Worship Team Run Sheet
    addSectionHeader('2. Scenski in tehnični razpored', '2. Stage & Audio Assignments');
    
    const stageMins = ministries.filter(m => m.category === 'av_tech' || m.id.toLowerCase().includes('slav') || m.id.toLowerCase().includes('worship'));
    stageMins.forEach(min => {
      builder.appendStyled(`  • ${isSl ? min.nameSl : min.nameEn}: `, 'bold');
      builder.appendLine(getAssignmentsList(min.id));
    });

    addSectionHeader('3. Pesmarica in dinamika slavljenja', '3. Setlist Schema & Transitions');
    builder.appendLine(isSl ? '[Nastavi pesmi za nedeljsko slavljenje spodaj]' : '[Define praise songs for the service below]');
    builder.appendLine();
    builder.appendLine(`1. PESEM / SONG 1: _____________________________________ [${isSl ? 'Hitra / Otvoritvena' : 'Fast / Fast-tempo opening'}]`);
    builder.appendLine(`2. PESEM / SONG 2: _____________________________________ [${isSl ? 'Srednje hitra' : 'Mid-tempo transition'}]`);
    builder.appendLine(`3. PESEM / SONG 3: _____________________________________ [${isSl ? 'Mirna / Molitvena' : 'Slow adoration'}]`);
    builder.appendLine(`4. PESEM / SONG 4: _____________________________________ [${isSl ? 'Odzivna po pridigi' : 'Sermon response hymn'}]`);

    addSectionHeader('4. Časnica za glasbenike', '4. Worship Schedule');
    if (isSl) {
      builder.appendLine('• 08:45 - Glasbeni prihod, uglaševanje in vklop osebnih monitorjev (In-ear)');
      builder.appendLine('• 09:00 - Zvočna vaja po inštrumentih in glasovih (skupni mix)');
      builder.appendLine('• 09:20 - Hitra vaja morebitnih novih vokalnih linij ali prehodov');
      builder.appendLine('• 09:35 - Skupna molitev v pisarni za duh sodelovanja in bogoslužje');
    } else {
      builder.appendLine('• 08:45 - Musicians arrive, tuner checks & in-ear monitor configuration');
      builder.appendLine('• 09:00 - Instrumental and vocal soundcheck (room balance setup)');
      builder.appendLine('• 09:20 - Run-through of complex key transitions or new chord charts');
      builder.appendLine('• 09:35 - Group prayer in the office for spiritual alignment and service flow');
    }

  } else if (docType === 'briefing_sheet') {
    // Template 3: Preacher and Host Briefing Sheet
    addSectionHeader('2. Ključne službe za učenje in vodenje', '2. Scribes, Reading & Speaking Roster');
    
    const keyMins = ministries.filter(m => m.category === 'sermon_prayer' || m.id.toLowerCase().includes('vod') || m.id.toLowerCase().includes('host'));
    keyMins.forEach(min => {
      builder.appendStyled(`  • ${isSl ? min.nameSl : min.nameEn}: `, 'bold');
      builder.appendLine(getAssignmentsList(min.id));
    });

    addSectionHeader('3. Gosti in splošna usmeritev', '3. Focus & Guest Speaker Profiles');
    builder.appendStyled(isSl ? 'Tema / Pridiga: ' : 'Sermon Focus Topic: ', 'bold');
    builder.appendLine(isSl ? (sunday.themeSl || '/') : (sunday.themeEn || '/'));
    
    builder.appendStyled(isSl ? 'Priprava ali opombe iz baze: ' : 'Planning notes: ', 'bold');
    builder.appendLine(sunday.absentOrNotes || (isSl ? 'Ni dodatnih logističnih posebnosti.' : 'No special instructions recorded.'));

    addSectionHeader('4. Pripravljalna struktura za pridigarja', '4. Core Outline & Scripture References');
    builder.appendLine(isSl ? '• Prebrana Svetopisemska vrstica: _________________________________' : '• Scripture Reading reference: _________________________________');
    builder.appendLine(isSl ? '• Glavne oporne točke pridige:' : '• Core Sermon highlights:');
    builder.appendLine('  1. ____________________________________________________________________');
    builder.appendLine('  2. ____________________________________________________________________');
    builder.appendLine('  3. ____________________________________________________________________');
    builder.appendLine(isSl ? '• Poziv k odzivu / Molitvene točke ob koncu:' : '• Altar call focus / Practical challenge lines:');
    builder.appendLine('  ________________________________________________________________________');

  } else if (docType === 'volunteers') {
    // Template 4: Volunteer Coordination Sheet
    addSectionHeader('2. Razpored prostovoljcev (Otroci, Kavica, Sprejem)', '2. Hospitality & Family Services');
    
    const volMins = ministries.filter(m => m.category === 'hospitality' || m.category === 'kids' || m.category === 'cleaning');
    volMins.forEach(min => {
      builder.appendStyled(`  • ${isSl ? min.nameSl : min.nameEn}: `, 'bold');
      builder.appendLine(getAssignmentsList(min.id));
    });

    addSectionHeader('3. Protokol in varnostni napotki s kontrolnim seznamom', '3. Service Checklists');
    
    builder.appendStyledLine(isSl ? 'OTROŠKI PROGRAM / SUNDAY SCHOOL:' : 'KIDS MINISTRY COMPLIANCE:', 'bold');
    builder.appendLine(isSl 
      ? '  [ ] Preveri, ali so na voljo vsi pripomočki (barvice, papir, prigrizki).\n  [ ] Preveri morebitne alergije otrok ob prevzemu.\n  [ ] Poskrbi za varen in urejen odhod otrok k staršem po koncu bogoslužja.'
      : '  [ ] Verify lesson materials are sorted (coloring pads, pencils, snacks).\n  [ ] Screen for allergen warnings during children registry handover.\n  [ ] Ensure structured parent pickup signatures at class dismissal.'
    );
    builder.appendLine();

    builder.appendStyledLine(isSl ? 'SPREJEM IN DRUŽENJE / WELCOMING & COFFEE:' : 'WELCOME TEAM & REFRESHMENTS:', 'bold');
    builder.appendLine(isSl
      ? '  [ ] Priprava letakov, revij in skrinjice za darove ob vhodu.\n  [ ] Priprava kave, čaja in vode (vklop kavnega aparata ob 09:15).\n  [ ] Sprejemanje obiskovalcev s prijaznim nasmehom in usmerjanje novih v dvorano.'
      : '  [ ] Set up bulletins, visual banners, and offering collection box at lobby.\n  [ ] Brew coffee, herbal tea, and refill ice water (initialize boilers active by 09:15).\n  [ ] Greet incoming guests, helping handovers to first-time family guides.'
    );

  } else if (docType === 'archive_note') {
    // Template 5: Post-Service Summary / Archive Note
    addSectionHeader('2. Seznam sodelavcev, ki so dejansko služili', '2. Historical Server Registry');
    
    ministries.forEach(min => {
      builder.appendStyled(`  • ${isSl ? min.nameSl : min.nameEn}: `, 'bold');
      builder.appendLine(getAssignmentsList(min.id));
    });

    addSectionHeader('3. Arhivska statistika in potek (Vpiši ročno)', '3. Service Performance Reporting');
    builder.appendLine(isSl ? '• Število udeležencev (Attendance): __________________' : '• Attendance Count: __________________');
    builder.appendLine(isSl ? '• Število otrok v otroškem programu: _______________' : '• Kids attendance total: _______________');
    builder.appendLine(isSl ? '• Zbrani prostovoljni darovi (EUR): _________________' : '• Total Roster offering amount (EUR): _________________');
    builder.appendLine();
    builder.appendStyledLine(isSl ? '• Ključna sporočila in molitvene potrebe:' : '• Important sermon takeaways & testimonies:', 'bold');
    builder.appendLine('  ________________________________________________________________________');
    builder.appendLine('  ________________________________________________________________________');
    builder.appendLine('  ________________________________________________________________________');
    builder.appendLine();
    builder.appendStyledLine(isSl ? '• Tehnični ali logistični izzivi za naslednjič:' : '• Critical improvement points / feedback logs:', 'bold');
    builder.appendLine('  ________________________________________________________________________');
  }

  // 3. Create a blank Google Document
  const documentText = builder.getText();
  
  const createResponse = await fetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: docTitle
    })
  });

  if (!createResponse.ok) {
    const errText = await createResponse.text();
    console.error('Failed to create Google Doc:', errText);
    throw new Error(`Google Docs API creation failed: ${errText}`);
  }

  const newDoc = await createResponse.json();
  const documentId = newDoc.documentId;
  const documentUrl = `https://docs.google.com/document/d/${documentId}/edit`;

  // 4. Batch update with the structured content and styling
  const requests: any[] = [
    // Insert all text at index 1
    {
      insertText: {
        location: { index: 1 },
        text: documentText
      }
    }
  ];

  // Map compiled builders back and generate text updates
  const stylesObj = builder.getStyles();
  
  // Apply visual styling to different text segments
  stylesObj.forEach(st => {
    // Guard index limits to avoid Google Docs batch failures
    if (st.start === st.end) return;

    if (st.type === 'title') {
      requests.push({
        updateTextStyle: {
          range: { startIndex: st.start, endIndex: st.end },
          textStyle: {
            bold: true,
            fontSize: { size: 20, unit: 'PT' },
            foregroundColor: {
              color: {
                rgbColor: { red: 0.26, green: 0.22, blue: 0.79 } // Indigo theme (#4338CA)
              }
            }
          },
          fields: 'bold,fontSize,foregroundColor'
        }
      });
    } else if (st.type === 'h1') {
      requests.push({
        updateTextStyle: {
          range: { startIndex: st.start, endIndex: st.end },
          textStyle: {
            bold: true,
            fontSize: { size: 14, unit: 'PT' },
            foregroundColor: {
              color: {
                rgbColor: { red: 0.26, green: 0.22, blue: 0.79 } // Indigo theme
              }
            }
          },
          fields: 'bold,fontSize,foregroundColor'
        }
      });
    } else if (st.type === 'h2') {
      requests.push({
        updateTextStyle: {
          range: { startIndex: st.start, endIndex: st.end },
          textStyle: {
            bold: true,
            fontSize: { size: 11, unit: 'PT' },
            foregroundColor: {
              color: {
                rgbColor: { red: 0.1, green: 0.1, blue: 0.1 }
              }
            }
          },
          fields: 'bold,fontSize,foregroundColor'
        }
      });
    } else if (st.type === 'bold') {
      requests.push({
        updateTextStyle: {
          range: { startIndex: st.start, endIndex: st.end },
          textStyle: {
            bold: true,
            fontSize: { size: 10, unit: 'PT' }
          },
          fields: 'bold,fontSize'
        }
      });
    } else if (st.type === 'italic') {
      requests.push({
        updateTextStyle: {
          range: { startIndex: st.start, endIndex: st.end },
          textStyle: {
            italic: true,
            fontSize: { size: 9.5, unit: 'PT' },
            foregroundColor: {
              color: {
                rgbColor: { red: 0.45, green: 0.45, blue: 0.45 }
              }
            }
          },
          fields: 'italic,fontSize,foregroundColor'
        }
      });
    }
  });

  const updateResponse = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      requests
    })
  });

  if (!updateResponse.ok) {
    const errText = await updateResponse.text();
    console.error('Failed to format Google Doc:', errText);
    // Ignore fatal styling failures if base content created successfully
  }

  return {
    documentId,
    documentUrl,
    title: docTitle
  };
}
