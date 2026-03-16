import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

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
  global.fetch = vi.fn();
});

describe('App routes', () => {
  it('renders the message form and reveals advanced options', async () => {
    const user = userEvent.setup();

    renderApp();

    const submitButton = screen.getByRole('button', { name: /create secret link/i });
    expect(submitButton).toBeDisabled();

    await user.type(screen.getByLabelText(/your secret message/i), 'top secret');
    expect(submitButton).toBeEnabled();

    await user.click(screen.getByRole('button', { name: /options/i }));
    expect(screen.getByLabelText(/additional passphrase/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/self-destruct after/i)).toBeInTheDocument();
  });

  it('submits a new secret and navigates to the generated link page', async () => {
    const user = userEvent.setup();
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'ok',
        newId: 'abc123',
      }),
    });

    renderApp();

    await user.type(screen.getByLabelText(/your secret message/i), 'ship it');
    await user.click(screen.getByRole('button', { name: /create secret link/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    expect(fetch).toHaveBeenCalledWith(
      '/api/saveSecret',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: expect.any(String),
      }),
    );

    const requestPayload = JSON.parse(fetch.mock.calls[0][1].body);
    expect(requestPayload).toEqual(expect.objectContaining({
      secretMessage: expect.any(String),
      hashedKey: expect.any(String),
      duration: 604800,
    }));

    const secretLinkField = await screen.findByLabelText(/secret one-time link/i);
    expect(secretLinkField.value).toContain('/v/#');
    expect(secretLinkField.value).toContain('abc123');
  });

  it('creates a one-time link from the password generator page and shows the standard result screen', async () => {
    const user = userEvent.setup();
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'ok',
        newId: 'gen123',
      }),
    });

    renderApp(['/password-generator']);

    await user.click(await screen.findByRole('button', { name: /share as link/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    expect(fetch).toHaveBeenCalledWith(
      '/api/saveSecret',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: expect.any(String),
      }),
    );

    const requestPayload = JSON.parse(fetch.mock.calls[0][1].body);
    expect(requestPayload).toEqual(expect.objectContaining({
      secretMessage: expect.any(String),
      hashedKey: expect.any(String),
      duration: 604800,
    }));

    const secretLinkField = await screen.findByLabelText(/secret one-time link/i);
    expect(secretLinkField.value).toContain('/v/#');
    expect(secretLinkField.value).toContain('gen123');
    expect(screen.getByText(/your secret link is ready/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /share as link/i })).not.toBeInTheDocument();
  });

  it('shows not found on unknown routes', async () => {
    renderApp(['/missing']);
    expect(await screen.findByText(/doesn't exist/i)).toBeInTheDocument();
  });

  it('treats invalid view links as destroyed after submit', async () => {
    const user = userEvent.setup();

    renderApp(['/v/short']);

    await user.click(await screen.findByRole('button', { name: /decrypt & read/i }));

    expect(await screen.findByText(/already been read or has expired/i)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});
