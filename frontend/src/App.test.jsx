import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
  },
}));

function renderApp(initialEntries = ['/']) {
  return render(
    <MemoryRouter
      initialEntries={initialEntries}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <App />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('App routes', () => {
  it('renders the message form and reveals advanced options', async () => {
    const user = userEvent.setup();

    renderApp();

    const submitButton = screen.getByRole('button', { name: /get a link/i });
    expect(submitButton).toBeDisabled();

    await user.type(screen.getByLabelText(/one-time message/i), 'top secret');
    expect(submitButton).toBeEnabled();

    await user.click(screen.getByRole('button', { name: /options/i }));
    expect(screen.getByLabelText(/additional secret key/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/keep message for:/i)).toBeInTheDocument();
  });

  it('submits a new secret and navigates to the generated link page', async () => {
    const user = userEvent.setup();
    axios.post.mockResolvedValue({
      data: {
        status: 'ok',
        newId: 'abc123',
      },
    });

    renderApp();

    await user.type(screen.getByLabelText(/one-time message/i), 'ship it');
    await user.click(screen.getByRole('button', { name: /get a link/i }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledTimes(1);
    });

    expect(axios.post).toHaveBeenCalledWith(
      '/api/saveSecret',
      expect.objectContaining({
        secretMessage: expect.any(String),
        hashedKey: expect.any(String),
        duration: 604800,
      })
    );

    const secretLinkField = await screen.findByLabelText(/secret one-time link/i);
    expect(secretLinkField.value).toContain('/v/#');
    expect(secretLinkField.value).toContain('abc123');
  });

  it('shows not found on unknown routes', () => {
    renderApp(['/missing']);
    expect(screen.getByText(/page not found/i)).toBeInTheDocument();
  });

  it('treats invalid view links as destroyed after submit', async () => {
    const user = userEvent.setup();

    renderApp(['/v/short']);

    await user.click(screen.getByRole('button', { name: /read the message/i }));

    expect(await screen.findByText(/message was destroyed/i)).toBeInTheDocument();
    expect(axios.post).not.toHaveBeenCalled();
  });
});
