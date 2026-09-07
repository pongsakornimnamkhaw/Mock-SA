import React from 'react';
import type { TimelineStep } from '../../types/contact';
import { Box, Typography } from '@mui/material';

interface StatusTimelineProps {
  title: string;
  steps: TimelineStep[];
}

export const StatusTimeline: React.FC<StatusTimelineProps> = ({ title, steps }) => {
  return (
    <Box component="section" className="panel-section active">
      <Typography component="h1" className="section-heading" sx={{ fontSize: '1.4rem', mb: '36px' }}>
        {title}
      </Typography>

      <div className="timeline-wrapper">
        {steps.map((step, index) => {
          const isCompleted = step.status === 'completed';
          const isCurrent = step.status === 'current';
          const isLast = index === steps.length - 1;

          return (
            <div key={step.id} className="timeline-item">
              <div className="timeline-left">
                <div
                  className={`timeline-pill ${
                    isCompleted
                      ? 'completed'
                      : isCurrent
                      ? 'current'
                      : 'pending'
                  }`}
                >
                  {step.title}
                </div>
              </div>

              <div className="timeline-center">
                <div
                  className={`timeline-dot ${
                    isCompleted || isCurrent ? 'active' : ''
                  }`}
                />
                {!isLast && (
                  <div
                    className={`timeline-line ${
                      isCompleted ? 'active' : ''
                    }`}
                  />
                )}
              </div>

              <div className="timeline-right">
                {step.time && <span className="timeline-time">{step.time}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </Box>
  );
};
