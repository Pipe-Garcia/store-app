package com.appTest.store.services;

import com.appTest.store.dto.sale.*;
import com.appTest.store.models.Sale;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface ISaleService {
    public List<Sale> getAllSales();
    public Sale getSaleById(Long idSale);
    public SaleDTO convertSaleToDto(Sale sale);
    public SaleSummaryByDateDTO getSaleSummaryByDate(@Param("date") LocalDate date);
    public SaleHighestDTO getHighestSale();
    public SaleDTO createSale(SaleCreateDTO dto);
    public void updateSale(SaleUpdateDTO dto);
    public void deleteSaleById(Long idSale);
}
