ALTER TABLE cash_sessions
  ADD COLUMN withdrawal_cash DECIMAL(19,2) NULL AFTER difference_cash,
  ADD COLUMN carry_over_cash DECIMAL(19,2) NULL AFTER withdrawal_cash;