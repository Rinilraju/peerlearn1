import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom';

// An isolated mock Component purely testing the rendering logic
const IsolatedComponent = () => (
   <div data-testid="test-wrapper">
       <h1>PeerLearn Dashboard</h1>
       <button onClick={() => {}}>Toggle Theme</button>
   </div>
);

describe('Frontend Unit Testing', () => {
    it('Should cleanly mount the isolated component without backend dependencies', () => {
        render(<IsolatedComponent />);
        
        // Vitest functionally ensuring the DOM matches expectations
        expect(screen.getByText('PeerLearn Dashboard')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /toggle theme/i })).toBeInTheDocument();
    });
});
