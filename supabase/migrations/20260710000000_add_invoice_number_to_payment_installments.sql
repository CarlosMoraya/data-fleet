ALTER TABLE public.payment_installments ADD COLUMN IF NOT EXISTS invoice_number TEXT;

COMMENT ON COLUMN public.payment_installments.invoice_number IS 'Número da NF/Fatura capturado por OCR no cadastro; nullable.';
