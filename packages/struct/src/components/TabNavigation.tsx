// src/components/TabNavigation.tsx
import React from 'react';

export type TabType = 'to-study' | 'done' | 'notes';

interface TabNavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  toStudyCount: number;
  doneCount: number;
}

const TabNavigation: React.FC<TabNavigationProps> = ({
  activeTab,
  onTabChange,
  toStudyCount,
  doneCount,
}) => {
  return (
    <div className="flex mb-4 border-b border-gray-700">
      <TabButton
        isActive={activeTab === 'to-study'}
        onClick={() => onTabChange('to-study')}
        label={`To Study (${toStudyCount})`}
      />
      <TabButton
        isActive={activeTab === 'done'}
        onClick={() => onTabChange('done')}
        label={`Done (${doneCount})`}
      />
      <TabButton
        isActive={activeTab === 'notes'}
        onClick={() => onTabChange('notes')}
        label="Notes"
      />
    </div>
  );
};

interface TabButtonProps {
  isActive: boolean;
  onClick: () => void;
  label: string;
}

const TabButton: React.FC<TabButtonProps> = ({ isActive, onClick, label }) => {
  return (
    <button
      aria-current={isActive}
      className={`px-4 py-2 text-lg transition-colors ${
        isActive
          ? 'text-green-400 border-b-2 border-green-400'
          : 'text-gray-400 hover:text-gray-100'
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
};

export default TabNavigation;
