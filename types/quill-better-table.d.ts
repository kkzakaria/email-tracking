declare module 'quill-better-table' {
  import Quill from 'quill';

  interface BetterTableModule {
    insertTable(rows: number, cols: number): void;
    getTable(): HTMLTableElement | null;
    deleteTable(): void;
  }

  interface OperationMenuItem {
    text: string;
  }

  interface OperationMenuConfig {
    items: {
      unmergeCells?: OperationMenuItem;
      insertColumnRight?: OperationMenuItem;
      insertColumnLeft?: OperationMenuItem;
      insertRowUp?: OperationMenuItem;
      insertRowDown?: OperationMenuItem;
      mergeCells?: OperationMenuItem;
      deleteColumn?: OperationMenuItem;
      deleteRow?: OperationMenuItem;
      deleteTable?: OperationMenuItem;
    };
  }

  interface BetterTableOptions {
    operationMenu?: {
      items?: OperationMenuConfig['items'];
    };
  }

  class QuillBetterTable {
    static keyboardBindings: any;
    
    constructor(quill: Quill, options?: BetterTableOptions);
    
    insertTable(rows: number, cols: number): void;
    getTable(): HTMLTableElement | null;
    deleteTable(): void;
  }

  export = QuillBetterTable;
}

declare module 'quill-better-table/dist/quill-better-table.css';