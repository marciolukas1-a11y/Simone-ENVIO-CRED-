import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./tests/setup.ts'],
    // Todos os arquivos de teste usam o mesmo banco SQLite de teste (mesmo
    // caminho) -- roda em série pra evitar dois processos mexendo no mesmo
    // arquivo WAL ao mesmo tempo.
    fileParallelism: false,
  },
});
