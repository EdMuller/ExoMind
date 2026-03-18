export const generateICS = (scheduleData: { title?: string, date?: string, time?: string, summary?: string, location?: string }) => {
  try {
    const { title, date, time, summary, location } = scheduleData;
    
    let startDate = new Date();
    let endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

    if (date && time) {
      // Expected format from AI: DD/MM/YYYY and HH:MM
      const dateParts = date.split('/');
      const timeParts = time.split(':');
      
      if (dateParts.length === 3 && timeParts.length >= 2) {
        const day = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1;
        const year = parseInt(dateParts[2], 10);
        const hours = parseInt(timeParts[0], 10);
        const minutes = parseInt(timeParts[1], 10);
        
        startDate = new Date(year, month, day, hours, minutes);
        endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour later
      }
    }

    const formatDate = (d: Date) => {
      return d.getFullYear().toString() +
             (d.getMonth() + 1).toString().padStart(2, '0') +
             d.getDate().toString().padStart(2, '0') + 'T' +
             d.getHours().toString().padStart(2, '0') +
             d.getMinutes().toString().padStart(2, '0') +
             '00';
    };

    const startDateStr = formatDate(startDate);
    const endDateStr = formatDate(endDate);

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      `DTSTART:${startDateStr}`,
      `DTEND:${endDateStr}`,
      `SUMMARY:${title || 'Agendamento'}`,
      `DESCRIPTION:${summary || ''}`,
      `LOCATION:${location || ''}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${(title || 'agendamento').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Erro ao gerar arquivo de calendário:', error);
    alert('Não foi possível gerar o arquivo de calendário.');
  }
};
