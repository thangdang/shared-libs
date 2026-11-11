/**
 * FAQ Page Component
 * Task: GRW-004 - Create FAQ pages (all apps)
 * 
 * Reusable FAQ page with:
 * - Category filtering
 * - Search functionality
 * - Accordion UI
 * - Schema.org FAQPage markup
 * - Vietnamese language support
 */
import { 
  Component, 
  Input, 
  OnInit, 
  OnChanges, 
  SimpleChanges,
  ChangeDetectionStrategy 
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category?: string;
  tags?: string[];
  helpful?: number;
  notHelpful?: number;
  relatedLinks?: Array<{ label: string; url: string }>;
  lastUpdated?: string;
}

export interface FAQCategory {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  count?: number;
}

@Component({
  selector: 'app-faq-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './faq-page.component.html',
  styleUrls: ['./faq-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FAQPageComponent implements OnInit, OnChanges {
  @Input() appName = 'AI Apps VN';
  @Input() faqs: FAQItem[] = [];
  @Input() categories: FAQCategory[] = [];
  @Input() showSearch = true;
  @Input() showCategories = true;
  @Input() showFeedback = true;
  @Input() showRelatedLinks = true;
  @Input() contactEmail = 'support@aiapps.vn';
  @Input() contactMessage = 'Không tìm thấy câu trả lời? Liên hệ chúng tôi!';

  searchQuery = '';
  selectedCategory = 'all';
  expandedIds = new Set<string>();
  filteredFaqs: FAQItem[] = [];
  schemaMarkup = '';

  ngOnInit(): void {
    this.filterFaqs();
    this.generateSchemaMarkup();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['faqs'] || changes['categories']) {
      this.filterFaqs();
      this.generateSchemaMarkup();
    }
  }

  filterFaqs(): void {
    let result = [...this.faqs];

    // Filter by category
    if (this.selectedCategory !== 'all') {
      result = result.filter(faq => faq.category === this.selectedCategory);
    }

    // Filter by search query
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      result = result.filter(faq => 
        faq.question.toLowerCase().includes(query) ||
        faq.answer.toLowerCase().includes(query) ||
        faq.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    this.filteredFaqs = result;
  }

  onSearch(): void {
    this.filterFaqs();
  }

  onCategoryChange(categoryId: string): void {
    this.selectedCategory = categoryId;
    this.filterFaqs();
  }

  toggleExpand(id: string): void {
    if (this.expandedIds.has(id)) {
      this.expandedIds.delete(id);
    } else {
      this.expandedIds.add(id);
    }
  }

  isExpanded(id: string): boolean {
    return this.expandedIds.has(id);
  }

  expandAll(): void {
    this.filteredFaqs.forEach(faq => this.expandedIds.add(faq.id));
  }

  collapseAll(): void {
    this.expandedIds.clear();
  }

  onFeedback(faqId: string, helpful: boolean): void {
    // Track feedback - integrate with analytics
    const event = {
      event: 'faq_feedback',
      faqId,
      helpful,
      appName: this.appName,
      timestamp: new Date().toISOString()
    };

    window.dispatchEvent(new CustomEvent('growth:analytics', { detail: event }));

    // Update local count (for UI)
    const faq = this.faqs.find(f => f.id === faqId);
    if (faq) {
      if (helpful) {
        faq.helpful = (faq.helpful || 0) + 1;
      } else {
        faq.notHelpful = (faq.notHelpful || 0) + 1;
      }
    }
  }

  getCategoryCount(categoryId: string): number {
    if (categoryId === 'all') return this.faqs.length;
    return this.faqs.filter(faq => faq.category === categoryId).length;
  }

  /**
   * Generate Schema.org FAQPage markup for SEO
   */
  private generateSchemaMarkup(): void {
    const faqSchema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      'mainEntity': this.faqs.map(faq => ({
        '@type': 'Question',
        'name': faq.question,
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': this.stripHtml(faq.answer)
        }
      }))
    };

    this.schemaMarkup = JSON.stringify(faqSchema);
  }

  private stripHtml(html: string): string {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  }

  trackByFaqId(index: number, faq: FAQItem): string {
    return faq.id;
  }

  trackByCategoryId(index: number, category: FAQCategory): string {
    return category.id;
  }
}
