import jsPDF from 'jspdf';
import { AppContext } from '../types/chat';

/**
 * Clean markdown from AI-generated text
 */
const cleanMarkdown = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
    .replace(/\*(.*?)\*/g, '$1') // Italic
    .replace(/#{1,6}\s/g, '') // Headers
    .replace(/`(.*?)`/g, '$1') // Code
    .replace(/\n{3,}/g, '\n\n') // Multiple newlines
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // Links
};

/**
 * Export chat answer to PDF
 */
export function exportChatAnswerToPdf(
  query: string,
  answer: string,
  userEmail: string,
  context: AppContext,
  conversationHistory?: { query: string; answer: string }[]
): void {
  try {
    // Initialize PDF (A4: 210mm x 297mm)
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 12;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;
    let pageNumber = 1;

    // Helper: Add footer to every page
    const addFooter = () => {
      pdf.setFontSize(7);
      pdf.setTextColor(120, 120, 120);
      pdf.text(
        'Generated via NeoLink AI Chat | AI-Generated Content - Verify Before Use',
        margin,
        pageHeight - 8
      );
      pdf.text(`Page ${pageNumber}`, pageWidth - margin - 15, pageHeight - 8);
      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    };

    // Helper: Check if we need a new page
    const checkNewPage = (neededHeight: number) => {
      if (y + neededHeight > pageHeight - 20) {
        addFooter();
        pdf.addPage();
        pageNumber++;
        y = margin;
        return true;
      }
      return false;
    };

    // Helper: Draw a colored section header
    const drawSectionHeader = (
      title: string,
      bgColor: [number, number, number] = [15, 23, 42]
    ) => {
      checkNewPage(14);
      pdf.setFillColor(...bgColor);
      pdf.rect(margin, y, contentWidth, 10, 'F');
      pdf.setFontSize(12);
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.text(title.toUpperCase(), margin + 4, y + 7);
      y += 13;
      pdf.setTextColor(0, 0, 0);
    };

    // Helper: Draw wrapped text block
    const drawTextBlock = (text: string, fontSize: number = 11, bold: boolean = false) => {
      const cleanText = cleanMarkdown(text);
      pdf.setFontSize(fontSize);
      pdf.setFont('helvetica', bold ? 'bold' : 'normal');
      pdf.setTextColor(30, 30, 30);
      const lines = pdf.splitTextToSize(cleanText, contentWidth - 6);
      for (let i = 0; i < lines.length; i++) {
        checkNewPage(7);
        pdf.text(lines[i], margin + 3, y);
        y += 6;
      }
      y += 3;
    };

    // Helper: Draw label-value pair
    const drawLabelValue = (label: string, value: string, labelWidth: number = 50) => {
      checkNewPage(10);
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(80, 80, 80);
      pdf.text(label + ':', margin + 3, y);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(20, 20, 20);
      const wrappedValue = pdf.splitTextToSize(value || 'N/A', contentWidth - labelWidth - 8);
      pdf.text(wrappedValue, margin + labelWidth, y);
      y += Math.max(7, wrappedValue.length * 6);
    };

    // ==================== PDF CONTENT ====================

    // --- HEADER SECTION ---
    pdf.setFillColor(15, 23, 42); // Slate-900
    pdf.rect(0, 0, pageWidth, 38, 'F');

    // NeoLink logo text
    pdf.setFontSize(24);
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.text('NEOLINK AI CHAT', margin, 18);

    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Intelligent Clinical Analytics & Support', margin, 28);

    // AI badge
    pdf.setFillColor(59, 130, 246); // Blue-500
    pdf.roundedRect(pageWidth - margin - 38, 12, 36, 12, 3, 3, 'F');
    pdf.setFontSize(10);
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.text('AI CHAT', pageWidth - margin - 35, 20);

    y = 46;

    // --- METADATA SECTION ---
    pdf.setFillColor(248, 250, 252); // Slate-50
    pdf.rect(margin, y, contentWidth, 24, 'F');
    pdf.setDrawColor(200, 200, 200);
    pdf.rect(margin, y, contentWidth, 24, 'S');

    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    pdf.setFont('helvetica', 'bold');
    pdf.text('EXPORT DETAILS', margin + 5, y + 8);

    pdf.setFontSize(10);
    pdf.setTextColor(20, 20, 20);
    pdf.setFont('helvetica', 'normal');
    const exportDate = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    pdf.text(`Date: ${exportDate}`, margin + 5, y + 15);
    pdf.text(`User: ${userEmail}`, margin + 5, y + 21);

    // Context info on right side
    pdf.text(`Page: ${context.currentPage}`, contentWidth / 2 + margin + 10, y + 15);
    if (context.selectedUnit) {
      pdf.text(`Unit: ${context.selectedUnit}`, contentWidth / 2 + margin + 10, y + 21);
    }

    y += 30;

    // --- QUERY SECTION ---
    drawSectionHeader('USER QUERY', [59, 130, 246]); // Blue
    drawTextBlock(query, 11, true);
    y += 5;

    // --- ANSWER SECTION ---
    drawSectionHeader('AI RESPONSE', [34, 197, 94]); // Green
    drawTextBlock(answer, 11);
    y += 5;

    // --- CONVERSATION HISTORY (if provided) ---
    if (conversationHistory && conversationHistory.length > 0) {
      y += 5;
      drawSectionHeader('CONVERSATION HISTORY', [100, 116, 139]); // Slate-500

      conversationHistory.forEach((exchange, index) => {
        checkNewPage(20);
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(60, 60, 60);
        pdf.text(`Q${index + 1}: ${exchange.query}`, margin + 3, y);
        y += 7;

        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(80, 80, 80);
        const answerLines = pdf.splitTextToSize(
          cleanMarkdown(exchange.answer),
          contentWidth - 10
        );
        answerLines.forEach((line: string) => {
          checkNewPage(6);
          pdf.text(line, margin + 8, y);
          y += 6;
        });
        y += 8;
      });
    }

    // --- DISCLAIMER SECTION ---
    y += 10;
    checkNewPage(25);
    pdf.setFillColor(254, 243, 199); // Amber-100
    pdf.rect(margin, y, contentWidth, 22, 'F');
    pdf.setDrawColor(251, 191, 36); // Amber-400
    pdf.setLineWidth(0.5);
    pdf.rect(margin, y, contentWidth, 22, 'S');

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(146, 64, 14); // Amber-900
    pdf.text('⚠ IMPORTANT DISCLAIMER', margin + 4, y + 7);

    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    const disclaimerText = pdf.splitTextToSize(
      'This content is AI-generated and should not replace professional clinical judgment. Always verify information with current clinical guidelines and consult with qualified healthcare professionals before making medical decisions.',
      contentWidth - 8
    );
    pdf.text(disclaimerText, margin + 4, y + 13);

    // Add final footer
    addFooter();

    // Save PDF
    const fileName = `NeoLink-AI-Chat-${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(fileName);

    console.log('PDF exported successfully:', fileName);
  } catch (error) {
    console.error('Error exporting PDF:', error);
    throw new Error('Failed to export PDF. Please try again.');
  }
}

/**
 * Export full conversation to PDF
 */
export function exportFullConversationToPdf(
  conversations: { query: string; answer: string; timestamp: string }[],
  userEmail: string,
  context: AppContext
): void {
  if (conversations.length === 0) {
    throw new Error('No conversation to export');
  }

  // Use the latest conversation as the main query/answer
  const latest = conversations[conversations.length - 1];
  const history = conversations.slice(0, -1);

  exportChatAnswerToPdf(latest.query, latest.answer, userEmail, context, history);
}
