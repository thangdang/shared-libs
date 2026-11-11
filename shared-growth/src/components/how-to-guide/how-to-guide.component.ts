/**
 * How-To Guide Component
 * Task: GRW-005 - Write "How to" guides
 * 
 * Reusable step-by-step guide component with:
 * - Numbered steps
 * - Images/videos
 * - Progress tracking
 * - Schema.org HowTo markup
 * - Vietnamese language support
 */
import { Component, Input, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface HowToStep {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  videoUrl?: string;
  duration?: string;  // e.g., "2 phút"
  tip?: string;
  warning?: string;
  links?: Array<{ label: string; url: string }>;
}

export interface HowToGuide {
  id: string;
  title: string;
  description: string;
  appName?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  estimatedTime?: string;  // e.g., "10 phút"
  category?: string;
  steps: HowToStep[];
  prerequisites?: string[];
  tools?: Array<{ name: string; url?: string }>;
  tags?: string[];
  author?: string;
  lastUpdated?: string;
  relatedGuides?: Array<{ title: string; url: string }>;
}

@Component({
  selector: 'app-how-to-guide',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './how-to-guide.component.html',
  styleUrls: ['./how-to-guide.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HowToGuideComponent implements OnInit {
  @Input() guide!: HowToGuide;
  @Input() showProgress = true;
  @Input() showTableOfContents = true;
  @Input() showSchema = true;

  completedSteps = new Set<string>();
  schemaMarkup = '';
  progressPercent = 0;

  ngOnInit(): void {
    if (this.showSchema) {
      this.generateSchemaMarkup();
    }
  }

  toggleStepComplete(stepId: string): void {
    if (this.completedSteps.has(stepId)) {
      this.completedSteps.delete(stepId);
    } else {
      this.completedSteps.add(stepId);
    }
    this.updateProgress();
  }

  isStepComplete(stepId: string): boolean {
    return this.completedSteps.has(stepId);
  }

  markAllComplete(): void {
    this.guide.steps.forEach(step => this.completedSteps.add(step.id));
    this.updateProgress();
  }

  resetProgress(): void {
    this.completedSteps.clear();
    this.updateProgress();
  }

  scrollToStep(stepId: string): void {
    const element = document.getElementById(`step-${stepId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  private updateProgress(): void {
    if (this.guide.steps.length === 0) {
      this.progressPercent = 0;
      return;
    }
    this.progressPercent = Math.round(
      (this.completedSteps.size / this.guide.steps.length) * 100
    );
  }

  getDifficultyLabel(difficulty?: string): string {
    const labels: Record<string, string> = {
      'easy': 'Dễ',
      'medium': 'Trung bình',
      'hard': 'Khó'
    };
    return labels[difficulty || 'easy'] || 'Dễ';
  }

  getDifficultyColor(difficulty?: string): string {
    const colors: Record<string, string> = {
      'easy': '#4CAF50',
      'medium': '#FF9800',
      'hard': '#F44336'
    };
    return colors[difficulty || 'easy'] || '#4CAF50';
  }

  /**
   * Generate Schema.org HowTo markup for SEO
   */
  private generateSchemaMarkup(): void {
    const schema: any = {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      'name': this.guide.title,
      'description': this.guide.description,
      'step': this.guide.steps.map((step, index) => ({
        '@type': 'HowToStep',
        'position': index + 1,
        'name': step.title,
        'text': step.description,
        ...(step.imageUrl && {
          'image': {
            '@type': 'ImageObject',
            'url': step.imageUrl
          }
        }),
        ...(step.videoUrl && {
          'video': {
            '@type': 'VideoObject',
            'contentUrl': step.videoUrl
          }
        })
      }))
    };

    // Optional fields
    if (this.guide.estimatedTime) {
      schema.totalTime = this.convertToISO8601Duration(this.guide.estimatedTime);
    }

    if (this.guide.tools?.length) {
      schema.tool = this.guide.tools.map(tool => ({
        '@type': 'HowToTool',
        'name': tool.name,
        ...(tool.url && { 'url': tool.url })
      }));
    }

    this.schemaMarkup = JSON.stringify(schema);
  }

  /**
   * Convert Vietnamese duration to ISO 8601 format
   * e.g., "10 phút" -> "PT10M"
   */
  private convertToISO8601Duration(duration: string): string {
    const match = duration.match(/(\d+)\s*(phút|giờ|giây)/i);
    if (!match) return 'PT0M';

    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    switch (unit) {
      case 'giây':
        return `PT${value}S`;
      case 'phút':
        return `PT${value}M`;
      case 'giờ':
        return `PT${value}H`;
      default:
        return `PT${value}M`;
    }
  }

  trackByStepId(index: number, step: HowToStep): string {
    return step.id;
  }
}
