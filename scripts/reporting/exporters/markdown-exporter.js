export function toMarkdown(doc) {
  const lines = [];
  lines.push(`# ${doc.title}`);
  lines.push(`_Период: ${doc.period}_`);
  lines.push('');
  for (const section of doc.sections) {
    lines.push(`## ${section.heading}`);
    if (section.summary) { lines.push(section.summary); lines.push(''); }
    if (section.items) { for (const item of section.items) lines.push(`- ${item}`); lines.push(''); }
    if (section.groups) {
      for (const group of section.groups) {
        lines.push(`### ${group.groupTitle}`);
        for (const item of group.items) lines.push(`- ${item}`);
        lines.push('');
      }
    }
  }
  return lines.join('\n');
}
