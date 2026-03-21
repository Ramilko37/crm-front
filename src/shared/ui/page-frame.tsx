"use client";

import { Button, Card, Space, Typography } from "antd";
import type { ReactNode } from "react";

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <Card className="crm-page-header-card">
      <div className="crm-page-header-row">
        <div>
          <Typography.Title level={2} className="crm-page-title">
            {title}
          </Typography.Title>
          {subtitle ? <Typography.Paragraph className="crm-page-subtitle">{subtitle}</Typography.Paragraph> : null}
        </div>
        {actions ? <div className="crm-page-header-actions">{actions}</div> : null}
      </div>
    </Card>
  );
}

export interface PageToolbarProps {
  search?: ReactNode;
  actions?: ReactNode;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  toggleLabel?: string;
}

export function PageToolbar({
  search,
  actions,
  filtersOpen,
  onToggleFilters,
  toggleLabel = "Фильтры",
}: PageToolbarProps) {
  return (
    <Card className="crm-toolbar-card">
      <div className="crm-toolbar-row crm-toolbar-inline">
        {actions ? <Space wrap>{actions}</Space> : null}
        <div className="crm-toolbar-search">{search}</div>
        <Button type="link" onClick={onToggleFilters}>
          {filtersOpen ? `Скрыть ${toggleLabel.toLowerCase()}` : `Раскрыть ${toggleLabel.toLowerCase()}`}
        </Button>
      </div>
    </Card>
  );
}

export interface FilterPanelProps {
  open: boolean;
  children: ReactNode;
}

export function FilterPanel({ open, children }: FilterPanelProps) {
  if (!open) {
    return null;
  }

  return <Card className="crm-filter-panel-card">{children}</Card>;
}
