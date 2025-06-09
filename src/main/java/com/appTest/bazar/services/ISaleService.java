package com.appTest.bazar.services;

import com.appTest.bazar.dto.sale.*;
import com.appTest.bazar.models.Sale;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface ISaleService {

    public List<Sale> getAllSales();

    public Sale getSaleById(Long idSale);

    public SaleDTO convertSaleToDto(Sale sale);

    public SaleSummaryByDateDTO getSaleSummaryByDate(@Param("date") LocalDate date);

    public SaleHighestDTO getHighestSale();

    public void createSale(SaleCreateDTO dto);

    public void updateSale(SaleUpdateDTO dto);

    public void deleteSaleById(Long idSale);
}
