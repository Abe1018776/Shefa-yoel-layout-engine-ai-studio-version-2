export interface BookContent {
  title: string;
  pageNumber: string;
  mainText: SectionData;
  commentaryA: SectionData; // Usually Right or Inner (Footnotes)
  commentaryB: SectionData; // Usually Left or Outer (Endnotes)
  direction: 'ltr' | 'rtl';
  layout: LayoutConfig;
}

export interface SectionData {
  id: string;
  label: string;
  content: string;
}

export enum SectionType {
  MAIN = 'MAIN',
  COMM_A = 'COMM_A',
  COMM_B = 'COMM_B'
}

export type LayoutMode = 'columns' | 'wrap-a' | 'wrap-b';

export interface LayoutConfig {
  mainHeightPercentage: number; // 0 to 100
  commentarySplitPercentage: number; // 0 to 100 (Split between A and B)
  mode: LayoutMode;
}