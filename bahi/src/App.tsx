import { createContext, useContext } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ToastHost } from './components/ui';
import Layout from './components/Layout';
import { useBooks } from './lib/hooks';
import Setup from './pages/Setup';
import Dashboard from './pages/Dashboard';
import Parties from './pages/Parties';
import Items from './pages/Items';
import TxnList from './pages/TxnList';
import TxnForm from './pages/TxnForm';
import TxnView from './pages/TxnView';
import PaymentForm from './pages/PaymentForm';
import CashBank from './pages/CashBank';
import Reports from './pages/Reports';
import Gst from './pages/Gst';
import Settings from './pages/Settings';
import Backup from './pages/Backup';
import Reminders from './pages/Reminders';
import DesignSheet from './pages/DesignSheet';
import type { TxnType } from './lib/types';
import { TXN } from './lib/types';

type BooksCtx = NonNullable<ReturnType<typeof useBooks>>;
const Ctx = createContext<BooksCtx | null>(null);
export const useBook = () => useContext(Ctx)!;

const listTypes: TxnType[] = ['sale', 'sale_return', 'estimate', 'sale_order', 'delivery_challan', 'purchase', 'purchase_return', 'purchase_order', 'expense', 'other_income', 'payment_in', 'payment_out'];

export default function App() {
  const books = useBooks();
  if (!books) return <div className="grid h-full place-items-center text-text-muted">Opening your books…</div>;
  return (
    <ToastHost>
      <Ctx.Provider value={books}>
        <HashRouter>
          {!books.firm ? (
            <Routes>
              <Route path="/design" element={<DesignSheet />} />
              <Route path="*" element={<Setup />} />
            </Routes>
          ) : (
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="parties" element={<Parties />} />
                <Route path="parties/:id" element={<Parties />} />
                <Route path="items" element={<Items />} />
                <Route path="items/:id" element={<Items />} />
                {listTypes.map((t) => (
                  <Route key={t} path={TXN[t].path} element={<TxnList type={t} />} />
                ))}
                {listTypes.filter((t) => TXN[t].hasLines).map((t) => (
                  <Route key={t + 'new'} path={TXN[t].path + '/new'} element={<TxnForm type={t} />} />
                ))}
                <Route path="sale/payments/new" element={<PaymentForm type="payment_in" />} />
                <Route path="purchase/payments/new" element={<PaymentForm type="payment_out" />} />
                <Route path="txn/:id" element={<TxnView />} />
                <Route path="txn/:id/edit" element={<TxnForm />} />
                <Route path="cash-bank" element={<CashBank />} />
                <Route path="reports" element={<Reports />} />
                <Route path="reports/:key" element={<Reports />} />
                <Route path="gst" element={<Gst />} />
                <Route path="reminders" element={<Reminders />} />
                <Route path="settings" element={<Settings />} />
                <Route path="backup" element={<Backup />} />
                <Route path="design" element={<DesignSheet />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          )}
        </HashRouter>
      </Ctx.Provider>
    </ToastHost>
  );
}
