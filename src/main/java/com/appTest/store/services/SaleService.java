package com.appTest.store.services;

import com.appTest.store.dto.productSale.ProductSaleRequestDTO;
import com.appTest.store.dto.sale.*;
import com.appTest.store.models.Client;
import com.appTest.store.models.Material;
import com.appTest.store.models.SaleDetail;
import com.appTest.store.models.Sale;
import com.appTest.store.repositories.IClientRepository;
import com.appTest.store.repositories.IProductRepository;
import com.appTest.store.repositories.ISaleRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
public class SaleService implements ISaleService{

    @Autowired
    private ISaleRepository repoSale;

    @Autowired
    @Lazy
    private IClientRepository repoClient;

    @Autowired
    @Lazy
    private IProductRepository repoProd;

    @Override
    public List<Sale> getAllSales() {
        return repoSale.findAll();
    }

    @Override
    public Sale getSaleById(Long idSale) {
        return repoSale.findById(idSale).orElse(null);
    }

    @Override
    public SaleDTO convertSaleToDto(Sale sale) {
        String nameClient = (sale.getClient() != null) ? sale.getClient().getName() : "Name not found";
        String surnameClient = (sale.getClient() != null) ? sale.getClient().getSurname() : "Surname not found";

        String completeNameClient = nameClient + " " + surnameClient;

        return new SaleDTO(
                completeNameClient,
                sale.getDateSale(),
                sale.getTotal()
        );
    }

    @Override
    public SaleSummaryByDateDTO getSaleSummaryByDate(LocalDate date) {
        return repoSale.getSaleSummaryByDate(date);
    }

    @Override
    public SaleHighestDTO getHighestSale() {
        List<SaleHighestDTO> list = repoSale.getHighestSale();
        return list.isEmpty() ? null : list.get(0);
    }


    @Override
    public void createSale(SaleCreateDTO dto) {
        Sale sale = new Sale();
        sale.setDateSale(dto.getDateSale());

        Client client = repoClient.findById(dto.getClientId()).orElse(null);
        sale.setClient(client);

        List<SaleDetail> saleDetailList = new ArrayList<>();
        double totalAmount = 0.0;

        for (ProductSaleRequestDTO item : dto.getProducts()) {
            Material material = repoProd.findById(item.getProductId()).orElse(null);
            if (material != null) {
                SaleDetail ps = new SaleDetail();
                ps.setMaterial(material);
                ps.setSale(sale);
                ps.setQuantity(item.getQuantity());
                ps.setPriceUni(material.getPrice());

                saleDetailList.add(ps);

                totalAmount += material.getPrice() * item.getQuantity();


                material.setQuantityAvailable(material.getQuantityAvailable() - item.getQuantity());
            }
        }

        sale.setTotal(totalAmount);
        sale.setSaleDetailList(saleDetailList);

        repoSale.save(sale);
    }


    @Override
    public void updateSale(SaleUpdateDTO dto) {
            Sale sale = repoSale.findById(dto.getIdSale()).orElse(null);

            if (sale != null) {
                if (dto.getDateSale() != null) sale.setDateSale(dto.getDateSale());
                if (dto.getTotal() != null) sale.setTotal(dto.getTotal());

                if (dto.getClientId() != null) {
                    Client client = repoClient.findById(dto.getClientId()).orElse(null);
                    sale.setClient(client);
                };

                repoSale.save(sale);
            }
    }

    @Override
    public void deleteSaleById(Long idSale) {
            repoSale.deleteById(idSale);
    }
}
