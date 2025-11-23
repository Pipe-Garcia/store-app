ALTER TABLE delivery_item
    ADD COLUMN sale_detail_id BIGINT NULL;

ALTER TABLE delivery_item
    ADD CONSTRAINT fk_delivery_item_sale_detail
        FOREIGN KEY (sale_detail_id) REFERENCES sale_detail(id_sale_detail);
